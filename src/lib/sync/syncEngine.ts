/**
 * BabyBloom Cloud Sync — Sync Engine (State Machine)
 *
 * Implements the sync cycle:
 *   IDLE → UPLOADING → DOWNLOADING → MERGING → APPLYING → IDLE
 *
 * Triggers:
 *   - On app open (visibilitychange to visible)
 *   - On data write (immediate trigger, bypasses 5-min wait)
 *   - Periodic timer (5-minute interval)
 *   - Manual "Sync Now" button
 *
 * Guarantees:
 *   - Only one sync cycle runs at a time
 *   - Local IndexedDB is never corrupted by partial sync
 *   - Merge result is applied atomically
 *   - All network operations have 60-second timeout
 *
 * Platform-specific scheduling:
 *   iOS/Android (Capacitor): Background App Refresh / WorkManager (handled natively)
 *   PWA Chrome: Periodic Background Sync API (registered separately)
 *   PWA Safari/iOS: On-write + on-open only (no background sync)
 *
 * Design §5.4 — Sync State Machine
 */

import { dg, ds } from '@/lib/db';
import { loadFamilyKey } from './keyManager';
import { buildSnapshot, applySnapshot, getOrCreateDeviceId, getDeviceName } from './snapshot';
import { mergeSnapshots } from './merge';
import { encryptJSON, decryptJSON, isValidBB2Header } from './encryption';
import {
  uploadFile,
  downloadFile,
  downloadFileById,
  listDeviceFiles,
  listDeviceFilesFromManifest,
  hasLegacyFullDriveScope,
  deviceStateFileName,
  deviceStatePrevFileName,
  MANIFEST_FILE,
  DriveError,
  clearSharedFolderId,
} from './googleDrive';
import type { StateSnapshot, SyncManifest, SyncStatus, SyncState } from './types';
import {
  DB_KEY_SYNC_ENABLED,
  DB_KEY_LAST_SYNC,
  DB_KEY_SYNC_STATUS,
  DB_KEY_MANIFEST_FILE_ID,
  DB_KEY_SYNC_MIGRATION_VERSION,
  GOOGLE_DRIVE_SCOPE_LEGACY,
  CLOCK_SKEW_WARN_MS,
} from './types';
import type { GoogleTokens } from './types';
import { Sentry } from '@/lib/sentry';

// ═══ ONE-TIME MIGRATIONS ═══

/**
 * Current migration version. Bump this when adding new migrations.
 * Each migration runs at most once (guarded by the stored version number).
 */
const CURRENT_MIGRATION_VERSION = 1;

/**
 * Run any pending one-time sync migrations on app startup.
 * Safe to call multiple times — each migration is idempotent and version-gated.
 *
 * Preserves: family key, folder ID, device ID, all local data (logs, profiles, etc.)
 * Only clears: Google OAuth tokens (forces re-auth with drive.file scope)
 */
export async function runSyncMigrations(): Promise<void> {
  const stored = (await dg(DB_KEY_SYNC_MIGRATION_VERSION)) as number | null;
  const version = stored || 0;
  if (version >= CURRENT_MIGRATION_VERSION) return; // already up to date

  // ── Migration 1: Force re-auth to move from full drive → drive.file scope ──
  if (version < 1) {
    const tokens = (await dg('family_google_tokens')) as GoogleTokens | null;
    if (tokens?.scope) {
      const hasLegacy = tokens.scope.split(/[\s,]+/).some(
        (s) => s === GOOGLE_DRIVE_SCOPE_LEGACY,
      );
      if (hasLegacy) {
        // Clear only the OAuth tokens — everything else stays intact.
        // On next sync attempt the engine will surface "Not authenticated"
        // and the UI will prompt the user to sign in again with drive.file scope.
        await ds('family_google_tokens', null);
        // Preserve sync_enabled so the user sees "Google Drive not connected"
        // banner instead of losing their sync setup entirely.
      }
    }
  }

  await ds(DB_KEY_SYNC_MIGRATION_VERSION, CURRENT_MIGRATION_VERSION);
}

// ═══ SYNC ENGINE STATE ═══

let currentState: SyncState = 'idle';
let syncTimer: ReturnType<typeof setInterval> | null = null;
let writeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;
let engineStarted = false;
/** When true, a data write occurred while a sync was in progress.
 *  The engine will start another sync cycle after the current one finishes. */
let pendingWriteSync = false;

/** Listeners that receive SyncStatus updates */
const statusListeners = new Set<(status: SyncStatus) => void>();

/** Last known modification times of partner device files */
const partnerFileTimestamps: Map<string, string> = new Map();

// ═══ PUBLIC API ═══

/**
 * Subscribe to sync status updates.
 * Returns an unsubscribe function.
 */
export function onSyncStatus(listener: (status: SyncStatus) => void): () => void {
  statusListeners.add(listener);
  // Immediately emit current status
  getCurrentStatus().then((s) => listener(s));
  return () => statusListeners.delete(listener);
}

/**
 * Start the sync engine: register triggers and run an immediate sync.
 * Called when the user enables cloud sync or the app starts with sync already enabled.
 */
export async function startSyncEngine(): Promise<void> {
  if (engineStarted) return; // prevent duplicate listeners / timers on re-mount
  engineStarted = true;

  // Register on-open trigger (visibility change)
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Register Periodic Background Sync if available (Chrome PWA only)
  await registerPeriodicBackgroundSync();

  // Start 5-minute periodic timer
  startTimer();

  // Run an immediate sync on startup
  await triggerSync('open');
}

/**
 * Stop the sync engine (called when sync is disabled).
 */
export function stopSyncEngine(): void {
  engineStarted = false;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  stopTimer();
  if (writeDebounceTimer) clearTimeout(writeDebounceTimer);
}

/**
 * Notify the sync engine that data was written.
 * Triggers an immediate sync (debounced by 2 seconds to batch rapid writes).
 */
export function notifyDataWrite(): void {
  if (writeDebounceTimer) clearTimeout(writeDebounceTimer);
  writeDebounceTimer = setTimeout(() => {
    triggerSync('write').catch(() => {/* silently ignore errors on write-triggered syncs */});
  }, 2_000);
}

/**
 * Manually trigger a sync cycle (e.g., from "Sync Now" button).
 */
export async function triggerSync(reason: 'manual' | 'timer' | 'open' | 'write' = 'manual'): Promise<SyncStatus> {
  if (isSyncing) {
    // A data write happened while sync is running — schedule a follow-up cycle
    // so the newly written entry isn't lost if applySnapshot overwrites it.
    if (reason === 'write') {
      pendingWriteSync = true;
    }
    return getCurrentStatus();
  }

  const enabled = await dg(DB_KEY_SYNC_ENABLED);
  if (!enabled) return { state: 'idle' };

  isSyncing = true;
  try {
    await runSyncCycle(reason);
  } catch (err) {
    const isDriveError = err instanceof DriveError;
    const msg = isDriveError ? err.userMessage : 'Sync failed. Will retry.';
    await setStatus({ state: 'error', errorMessage: msg });

    // Report to Sentry — skip expected transient conditions (offline, auth, rate-limit, scope)
    // scope_insufficient is a known user-action-required state, not a code bug.
    // network errors ('Load failed' on iOS/Safari) are transient connectivity issues, not bugs.
    const skipCodes = new Set([
      'not_authenticated',
      'token_revoked',
      'scope_insufficient',
      'offline',
      'rate_limited',
      'timeout',
      'network',
    ]);
    if (!isDriveError || !skipCodes.has((err as DriveError).code)) {
      Sentry.captureException(err, { tags: { sync_reason: reason } });
    }
  } finally {
    isSyncing = false;
  }

  // If a data write happened while we were syncing, run another cycle
  // so the newly written entry gets properly uploaded and merged.
  if (pendingWriteSync) {
    pendingWriteSync = false;
    // Small delay to let any in-flight IndexedDB writes settle
    setTimeout(() => {
      triggerSync('write').catch(() => {});
    }, 500);
  }

  return getCurrentStatus();
}

// ═══ SYNC CYCLE ═══

async function runSyncCycle(reason: string): Promise<void> {
  const key = await loadFamilyKey();
  if (!key) {
    await setStatus({ state: 'error', errorMessage: 'Family key not found. Please re-enable sync.' });
    return;
  }

  const deviceId = await getOrCreateDeviceId();
  const deviceName = getDeviceName();

  // ── Step 1: UPLOADING ──
  await setStatus({ state: 'uploading' });

  // Take a point-in-time snapshot of local state
  const localSnapshot = await buildSnapshot(deviceId, deviceName);

  // Back up previous state file before overwriting (one-generation backup)
  const stateFileName = deviceStateFileName(deviceId);
  try {
    const existing = await downloadFile(stateFileName);
    if (existing) {
      await uploadFile(deviceStatePrevFileName(deviceId), existing);
    }
  } catch {
    // Non-fatal: backup failure doesn't block upload
  }

  // Encrypt and upload this device's state
  const encryptedState = await encryptJSON(localSnapshot, key);
  const stateFileId = await uploadFile(stateFileName, encryptedState);

  // Ensure manifest exists and register our state file ID
  const manifest = await ensureManifest(deviceId, deviceName, key, stateFileId);

  // ── Step 2: DOWNLOADING ──
  await setStatus({ state: 'downloading' });

  // Discover partner device files.
  // Prefer manifest-based discovery (works with drive.file scope).
  // Fall back to folder-listing query only for legacy full-drive-scope users
  // whose partners haven't yet registered their file IDs in the manifest.
  let deviceFiles: Array<{ name: string; id: string; modifiedTime: string }>;

  if (manifest && Object.values(manifest.devices).some((d) => d.state_file_id)) {
    // Primary path: manifest has file IDs → use ID-based access
    deviceFiles = await listDeviceFilesFromManifest(manifest);

    // If some devices don't have state_file_id yet (pre-migration partners),
    // supplement with folder-listing if we have legacy scope
    const registeredIds = new Set(
      Object.values(manifest.devices)
        .filter((d) => d.state_file_id)
        .map((d) => d.state_file_id),
    );
    const hasFullScope = await hasLegacyFullDriveScope();
    if (hasFullScope) {
      const folderFiles = await listDeviceFiles();
      for (const f of folderFiles) {
        if (!registeredIds.has(f.id)) {
          deviceFiles.push(f);
        }
      }
    }
  } else {
    // Fallback: no manifest file IDs yet → use folder-listing query
    // This covers legacy users and first-sync-after-migration scenarios
    deviceFiles = await listDeviceFiles();
  }

  const partnerFiles = deviceFiles.filter(
    (f) => f.name !== stateFileName && !f.name.includes('_prev'),
  );

  // Check if any partner files changed since last sync
  const changedPartnerFiles = partnerFiles.filter((f) => {
    const lastKnown = partnerFileTimestamps.get(f.id || f.name);
    return !lastKnown || lastKnown !== f.modifiedTime;
  });

  // Download only changed partner state files
  const remoteSnapshots: StateSnapshot[] = [];
  for (const file of changedPartnerFiles) {
    try {
      // Prefer ID-based download (works with drive.file for shared files)
      const data = file.id
        ? await downloadFileById(file.id)
        : await downloadFile(file.name);
      if (!data) continue;

      // Validate BB2 header before attempting decryption
      if (!isValidBB2Header(data)) {
        console.warn(`[Sync] Skipping ${file.name}: invalid BB2 header`);
        continue;
      }

      const snapshot = await decryptJSON<StateSnapshot>(data, key);

      // Validate schema version
      if (snapshot.schema_version !== 2) {
        console.warn(`[Sync] Skipping ${file.name}: unsupported schema v${snapshot.schema_version}`);
        continue;
      }

      remoteSnapshots.push(snapshot);
      partnerFileTimestamps.set(file.id || file.name, file.modifiedTime);
    } catch (err) {
      if (err instanceof DriveError) throw err; // propagate connectivity errors
      console.warn(`[Sync] Could not read ${file.name}: ${err}`);
      // Continue with other files — corrupted file is logged and skipped
    }
  }

  // ── Step 3: MERGING ──
  await setStatus({ state: 'merging', deviceCount: partnerFiles.length });

  if (remoteSnapshots.length === 0) {
    // Nothing to merge — already up to date
    const lastSyncAt = new Date().toISOString();
    await ds(DB_KEY_LAST_SYNC, lastSyncAt);
    await setStatus({ state: 'idle', lastSyncAt, deviceCount: partnerFiles.length });
    return;
  }

  const mergeResult = mergeSnapshots(localSnapshot, ...remoteSnapshots);

  // Warn user if clock skew is significant
  if (mergeResult.clockSkewMs > CLOCK_SKEW_WARN_MS) {
    console.warn(`[Sync] Clock skew detected: ${Math.round(mergeResult.clockSkewMs / 60000)} min`);
    // In production, this would trigger a UI notification
  }

  // ── Step 4: APPLYING ──
  await setStatus({ state: 'applying' });

  // Apply merged state atomically.
  // Pass the pre-sync local snapshot so applySnapshot can detect and preserve
  // any entries the user added while the sync cycle was in progress.
  await applySnapshot(mergeResult.snapshot, localSnapshot);

  // Notify the UI to reload data from IndexedDB so it reflects the merge
  // without requiring a full page reload. App.tsx listens for this event.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('babybloom:sync-applied'));
  }

  // ── Done ──
  const lastSyncAt = new Date().toISOString();
  await ds(DB_KEY_LAST_SYNC, lastSyncAt);
  await setStatus({
    state: 'idle',
    lastSyncAt,
    deviceCount: partnerFiles.length,
  });
}

// ═══ MANIFEST ═══

/**
 * Ensure manifest exists and register this device's state file ID.
 * Returns the manifest so the sync cycle can use it for file discovery.
 *
 * @param stateFileId - The Google Drive file ID of this device's state file (from uploadFile)
 */
async function ensureManifest(
  deviceId: string,
  deviceName: string,
  key: CryptoKey,
  stateFileId?: string,
): Promise<SyncManifest> {
  let manifest: SyncManifest | null = null;

  // Try to download existing manifest — first by stored file ID (drive.file safe),
  // then fall back to name-based search (needs folder query)
  const storedManifestId = await dg(DB_KEY_MANIFEST_FILE_ID) as string | null;
  try {
    let data: Uint8Array | null = null;
    if (storedManifestId) {
      data = await downloadFileById(storedManifestId);
    }
    if (!data) {
      data = await downloadFile(MANIFEST_FILE);
    }
    if (data && isValidBB2Header(data)) {
      manifest = await decryptJSON<SyncManifest>(data, key);
    }
  } catch {
    // No manifest yet — will create one
  }

  const now = new Date().toISOString();

  if (!manifest) {
    // Create new manifest (first parent enabling sync)
    manifest = {
      schema_version: 2,
      family_id: crypto.randomUUID?.() || generateSimpleId(),
      created_at: now,
      minimum_schema_version: 2,
      devices: {
        [deviceId]: {
          device_name: deviceName,
          last_seen: now,
          ...(stateFileId ? { state_file_id: stateFileId } : {}),
        },
      },
    };
  } else {
    // Update this device's entry with last_seen and state_file_id
    manifest.devices = manifest.devices || {};
    const existing = manifest.devices[deviceId] || {};
    manifest.devices[deviceId] = {
      ...existing,
      device_name: deviceName,
      last_seen: now,
      ...(stateFileId ? { state_file_id: stateFileId } : {}),
    };
  }

  // Upload manifest and store its file ID for future direct access.
  // Pass storedManifestId so uploadFile PATCHes the existing file by ID
  // instead of searching by name (which fails with drive.file scope for
  // manifests created by the partner's app instance).
  const encrypted = await encryptJSON(manifest, key);
  const manifestFileId = await uploadFile(MANIFEST_FILE, encrypted, storedManifestId || undefined);

  // Persist manifest file ID locally and in the manifest itself
  manifest.manifest_file_id = manifestFileId;
  await ds(DB_KEY_MANIFEST_FILE_ID, manifestFileId);

  return manifest;
}

// ═══ SCHEDULING ═══

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function startTimer(): void {
  stopTimer();
  syncTimer = setInterval(() => {
    triggerSync('timer').catch(() => {/* silently ignore */});
  }, SYNC_INTERVAL_MS);
}

function stopTimer(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    triggerSync('open').catch(() => {/* silently ignore */});
  }
}

/**
 * Register Periodic Background Sync for Chrome PWA.
 * Falls back gracefully if the API is not available.
 */
async function registerPeriodicBackgroundSync(): Promise<void> {
  try {
    const sw = await navigator.serviceWorker?.ready;
    if (sw && 'periodicSync' in sw) {
      const periodicSync = (sw as any).periodicSync;
      await periodicSync.register('babybloom-sync', {
        minInterval: SYNC_INTERVAL_MS,
      });
    }
  } catch {
    // Not available (Safari, Firefox, or permissions not granted) — silent fallback
  }
}

// ═══ STATUS ═══

async function setStatus(status: SyncStatus): Promise<void> {
  currentState = status.state;
  await ds(DB_KEY_SYNC_STATUS, status);
  for (const listener of statusListeners) {
    listener(status);
  }
}

async function getCurrentStatus(): Promise<SyncStatus> {
  const stored = await dg(DB_KEY_SYNC_STATUS);
  if (stored) return stored as SyncStatus;
  const lastSyncAt = await dg(DB_KEY_LAST_SYNC);
  return { state: currentState, lastSyncAt: lastSyncAt || undefined };
}

// ═══ SETUP / TEARDOWN ═══

/**
 * Enable cloud sync for the first time.
 * Runs data migration (backfill modified_at), then starts the engine.
 */
export async function enableSync(): Promise<void> {
  const { migrateForSync } = await import('./snapshot');
  await migrateForSync();
  await ds(DB_KEY_SYNC_ENABLED, true);
  await startSyncEngine();
}

/**
 * Disable cloud sync.
 * Stops engine, preserves local data untouched.
 *
 * @param deleteCloudData - If true, delete state files from Google Drive
 */
export async function disableSync(deleteCloudData = false): Promise<void> {
  await ds(DB_KEY_SYNC_ENABLED, false);
  stopSyncEngine();

  if (deleteCloudData) {
    try {
      const deviceId = await getOrCreateDeviceId();
      const { deleteFile } = await import('./googleDrive');
      await Promise.allSettled([
        deleteFile(deviceStateFileName(deviceId)),
        deleteFile(deviceStatePrevFileName(deviceId)),
      ]);
    } catch {
      // Non-fatal
    }
  }

  // Clear the stored shared folder ID
  await clearSharedFolderId();
}

/**
 * Check if sync is currently enabled.
 */
export async function isSyncEnabled(): Promise<boolean> {
  return !!(await dg(DB_KEY_SYNC_ENABLED));
}

// ═══ UTILITY ═══

function generateSimpleId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
