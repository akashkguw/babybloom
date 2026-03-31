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
  // Read all data from IndexedDB
  const [
    rawLogs,
    profileData,
    firsts,
    teeth,
    checked,       // milestones
    vDoneAll,      // vaccines by country
    emergencyContacts,
  ] = await Promise.all([
    dg('logs'),
    dg('profile'),
    dg('firsts'),
    dg('teeth'),
    dg('checked'),
    dg('vDoneAll'),
    dg('emergencyContacts'),
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
  };

  // ── Normalize profile ──
  const profile = profileData || {};
  const syncProfile: SyncProfile = {
    ...profile,
    // Backfill modified_at if not present (legacy device)
    modified_at: profile.modified_at || new Date(0).toISOString(),
    // Exclude device-local fields (theme, notifications)
  };
  // Remove non-synced profile fields
  delete (syncProfile as any).theme;
  delete (syncProfile as any).notifications;

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
    milestones: checked || {},
    vaccines: vDoneAll || {},
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
export async function applySnapshot(snapshot: StateSnapshot): Promise<void> {
  // Reconstruct the logs object in the format the app expects
  const logsToWrite = {
    feed:    snapshot.logs.feed    || [],
    diaper:  snapshot.logs.diaper  || [],
    sleep:   snapshot.logs.sleep   || [],
    growth:  snapshot.logs.growth  || [],
    temp:    snapshot.logs.temp    || [],
    bath:    snapshot.logs.bath    || [],
    massage: snapshot.logs.massage || [],
    meds:    snapshot.logs.meds    || [],
    allergy: snapshot.logs.allergy || [],
    pump:    snapshot.logs.pump    || [],
  };

  // Write all sync'd data in parallel
  await Promise.all([
    ds('logs', logsToWrite),
    ds('profile', snapshot.profile),
    ds('firsts', snapshot.firsts),
    ds('teeth', snapshot.teeth),
    ds('checked', snapshot.milestones),
    ds('vDoneAll', snapshot.vaccines),
    ds('emergencyContacts', snapshot.emergency_contacts),
  ]);
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

  const categories = ['feed', 'diaper', 'sleep', 'growth', 'temp', 'bath', 'massage', 'meds', 'allergy', 'pump'];
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

  // Ensure profile has modified_at
  const profile = await dg('profile');
  if (profile && !profile.modified_at) {
    await ds('profile', { ...profile, modified_at: new Date(0).toISOString() });
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
