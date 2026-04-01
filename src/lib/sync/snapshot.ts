/**
 * BabyBloom Cloud Sync — State Snapshot Builder
 *
 * Converts the app's current IndexedDB state (AppData format) into a
 * StateSnapshot for encryption and upload, and applies a merged snapshot
 * back to IndexedDB.
 *
 * Non-synced data (per design §3.3):
 *   - theme, notifications, active tab state, feed timer, sentry config
 *   - These remain device-local and are never included in snapshots.
 *
 * Selective sync privacy zones (per design §3.4):
 *   - Mom wellness data (excluded by default, opt-in to share)
 *   - Reminders (device-local)
 */

import { dg, ds } from '@/lib/db';
import { DB_KEY_DEVICE_ID } from './types';
import type { StateSnapshot, SyncProfile, SyncLogs } from './types';
import { backfillModifiedAt } from './merge';

// ═══ DEVICE ID ═══

/**
 * Get or create the unique device ID for this device.
 * Stored in IndexedDB; persists across app sessions.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await dg(DB_KEY_DEVICE_ID);
  if (!deviceId) {
    deviceId = generateUUID();
    await ds(DB_KEY_DEVICE_ID, deviceId);
  }
  return deviceId;
}

/**
 * Generate a UUID v4 using the Web Crypto API.
 */
export function generateUUID(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Set version 4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant bits
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ═══ SNAPSHOT BUILDER ═══

/**
 * Read the current app state from IndexedDB and build a StateSnapshot.
 * This is the plaintext state that will be AES-encrypted before upload.
 *
 * @param deviceId - UUID for this device
 * @param deviceName - Human-readable device name (e.g. "Akash's iPhone")
 */
export async function buildSnapshot(
  deviceId: string,
  deviceName: string,
): Promise<StateSnapshot> {
  // Read all data from IndexedDB using the ACTUAL key names that App.tsx writes.
  // App.tsx `spd()` helper writes every field to both a generic top-level key
  // (e.g. ds('logs', v)) and the profile-specific key (profileData_${id}).
  // We read the generic keys here since they always reflect the active profile.
  const [
    rawLogs,
    birthDate,
    firsts,
    teeth,
    milestones,
    vaccines,
    emergencyContacts,
    profiles,
    activeProfileId,
  ] = await Promise.all([
    dg('logs'),
    dg('birthDate'),
    dg('firsts'),
    dg('teeth'),
    dg('milestones'),    // App.tsx writes via spd('milestones', ...)
    dg('vaccines'),      // App.tsx writes via spd('vaccines', ...)
    dg('emergencyContacts'),
    dg('profiles'),
    dg('activeProfile'),
  ]);

  // ── Normalize logs — backfill modified_at for legacy entries ──
  const logs = rawLogs || {};

  const normalizeLogs = (arr: any[] | undefined) =>
    backfillModifiedAt(arr || []) as any[];

  const syncLogs: SyncLogs = {
    feed:    normalizeLogs(logs.feed),
    diaper:  normalizeLogs(logs.diaper),
    sleep:   normalizeLogs(logs.sleep),
    growth:  normalizeLogs(logs.growth),
    temp:    normalizeLogs(logs.temp),
    bath:    normalizeLogs(logs.bath),
    massage: normalizeLogs(logs.massage),
    meds:    normalizeLogs(logs.meds),
    allergy: normalizeLogs(logs.allergy),
    pump:    normalizeLogs(logs.pump),
    tummy:   normalizeLogs(logs.tummy),
  };

  // ── Build profile from app state ──
  // App.tsx stores baby name in profiles[] array and birthDate as a standalone key.
  const activeProfile = Array.isArray(profiles)
    ? profiles.find((p: any) => p.id === activeProfileId)
    : null;
  const syncProfile: SyncProfile = {
    name: activeProfile?.name || undefined,
    dob: birthDate || undefined,
    modified_at: new Date().toISOString(),
  };

  // ── Normalize firsts ──
  const syncFirsts = backfillModifiedAt(firsts || []) as any[];

  // ── Normalize emergency contacts ──
  const syncContacts = backfillModifiedAt(emergencyContacts || []) as any[];

  return {
    schema_version: 2,
    device_id: deviceId,
    device_name: deviceName,
    snapshot_at: new Date().toISOString(),
    profile: syncProfile,
    logs: syncLogs,
    firsts: syncFirsts,
    teeth: teeth || {},
    milestones: milestones || {},
    vaccines: vaccines || {},
    emergency_contacts: syncContacts,
  };
}

// ═══ SNAPSHOT APPLY ═══

/**
 * Apply a merged StateSnapshot to IndexedDB.
 * This is called after the merge algorithm produces the unified state.
 * Written atomically — all keys updated before any UI re-render.
 *
 * Note: device-local settings (theme, notifications, timers) are NOT touched.
 */
export async function applySnapshot(
  snapshot: StateSnapshot,
  /** The local snapshot taken at the START of the sync cycle. Used to detect
   *  entries the user added while the sync was in progress (race condition).
   *  Any entry in current IndexedDB that wasn't in this pre-sync snapshot
   *  must have been added during the cycle and is preserved. */
  preSyncLocal?: StateSnapshot,
): Promise<void> {
  // Read existing logs to preserve any categories not yet included in the snapshot
  // (defensive: prevents data loss if a new category is added to the app but not yet
  // to the sync schema).
  const existingLogs = (await dg('logs')) || {};

  // Reconstruct the logs object in the format the app expects.
  // Start from existing logs, then overlay every synced category.
  const syncedCategories = ['feed', 'diaper', 'sleep', 'growth', 'temp', 'bath', 'massage', 'meds', 'allergy', 'pump', 'tummy'] as const;

  const logsToWrite: Record<string, any[]> = { ...existingLogs };

  for (const cat of syncedCategories) {
    const mergedEntries: any[] = (snapshot.logs as any)[cat] || [];

    if (preSyncLocal) {
      // Detect entries added locally DURING the sync cycle:
      // present in current IndexedDB but absent from the pre-sync snapshot.
      const preSyncIds = new Set(
        ((preSyncLocal.logs as any)[cat] || [])
          .filter((e: any) => e.id != null)
          .map((e: any) => e.id),
      );
      const mergedIds = new Set(
        mergedEntries.filter((e: any) => e.id != null).map((e: any) => e.id),
      );
      const currentEntries: any[] = existingLogs[cat] || [];
      const addedDuringSync = currentEntries.filter(
        (e: any) => e.id != null && !preSyncIds.has(e.id) && !mergedIds.has(e.id),
      );

      if (addedDuringSync.length > 0) {
        logsToWrite[cat] = [...addedDuringSync, ...mergedEntries];
        continue;
      }
    }

    logsToWrite[cat] = mergedEntries;
  }

  const birthDate = snapshot.profile?.dob || null;

  // Write all sync'd data in parallel using the ACTUAL key names App.tsx reads.
  // App.tsx `spd()` writes to both generic keys and profileData_${id}.
  // We must write to both so the app sees merged data immediately AND on next load.
  const activeProfileId = await dg('activeProfile');

  const writes: Promise<void>[] = [
    // Generic top-level keys (used by spd() and the app's initial load fallback)
    ds('logs', logsToWrite),
    ds('birthDate', birthDate),
    ds('firsts', snapshot.firsts),
    ds('teeth', snapshot.teeth),
    ds('milestones', snapshot.milestones),     // NOT 'checked'
    ds('vaccines', snapshot.vaccines),          // NOT 'vDoneAll'
    ds('emergencyContacts', snapshot.emergency_contacts),
  ];

  // Also update the profile-specific bundle so loadProfileData() sees merged data
  if (activeProfileId) {
    writes.push(
      ds(`profileData_${activeProfileId}`, {
        logs: logsToWrite,
        milestones: snapshot.milestones,
        vaccines: snapshot.vaccines,
        teeth: snapshot.teeth,
        firsts: snapshot.firsts,
        birthDate,
      }),
    );

    // Update the baby name in the profiles array if the snapshot has one
    if (snapshot.profile?.name) {
      const profiles = await dg('profiles');
      if (Array.isArray(profiles)) {
        const updated = profiles.map((p: any) =>
          p.id === activeProfileId ? { ...p, name: snapshot.profile.name, birthDate } : p,
        );
        writes.push(ds('profiles', updated));
      }
    }
  }

  await Promise.all(writes);
}

// ═══ MIGRATION ═══

/**
 * Run the one-time data migration for first-time cloud sync activation.
 * Adds modified_at and deleted_at to all existing entries.
 * Idempotent: safe to run multiple times.
 */
export async function migrateForSync(): Promise<void> {
  const rawLogs = await dg('logs');
  if (!rawLogs) return;

  const categories = ['feed', 'diaper', 'sleep', 'growth', 'temp', 'bath', 'massage', 'meds', 'allergy', 'pump', 'tummy'];
  let changed = false;

  for (const cat of categories) {
    const arr = rawLogs[cat];
    if (!Array.isArray(arr)) continue;
    const migrated = backfillModifiedAt(arr);
    // Check if anything changed
    if (migrated.some((e, i) => e.modified_at !== arr[i]?.modified_at)) {
      rawLogs[cat] = migrated;
      changed = true;
    }
  }

  if (changed) {
    await ds('logs', rawLogs);
  }

  // Migrate firsts
  const firsts = await dg('firsts');
  if (Array.isArray(firsts)) {
    const migrated = backfillModifiedAt(firsts);
    if (migrated.some((e, i) => e.modified_at !== firsts[i]?.modified_at)) {
      await ds('firsts', migrated);
    }
  }

  // Migrate emergency contacts
  const contacts = await dg('emergencyContacts');
  if (Array.isArray(contacts)) {
    const migrated = backfillModifiedAt(contacts);
    if (migrated.some((e, i) => e.modified_at !== contacts[i]?.modified_at)) {
      await ds('emergencyContacts', migrated);
    }
  }

  // Also mirror generic keys → profileData bundle if not already consistent
  const activeProfileId = await dg('activeProfile');
  if (activeProfileId) {
    const milestones = await dg('milestones');
    const vaccines = await dg('vaccines');
    const teeth = await dg('teeth');
    const birthDate = await dg('birthDate');
    await ds(`profileData_${activeProfileId}`, {
      logs: rawLogs,
      milestones: milestones || {},
      vaccines: vaccines || {},
      teeth: teeth || {},
      firsts: firsts || [],
      birthDate: birthDate || null,
    });
  }
}

// ═══ DEVICE NAME DETECTION ═══

/**
 * Get a human-readable device name from the user agent / platform info.
 * Best-effort; not security-critical.
 */
export function getDeviceName(): string {
  const ua = navigator.userAgent || '';
  if (/iPhone/.test(ua)) return "Parent's iPhone";
  if (/iPad/.test(ua)) return "Parent's iPad";
  if (/Android/.test(ua)) {
    const m = ua.match(/Android [^;]+; ([^)]+)\)/);
    if (m) return m[1].trim();
    return "Parent's Android";
  }
  if (/Mac/.test(ua)) return "Parent's Mac";
  if (/Windows/.test(ua)) return "Parent's PC";
  return 'BabyBloom Web';
}
