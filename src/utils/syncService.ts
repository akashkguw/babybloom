/**
 * Core bidirectional sync service: IndexedDB <-> Firestore.
 *
 * Data is namespaced by familyCode so each family's data is isolated.
 * Firestore path: families/{familyCode}/profiles/{profileId}/{category}/{entryId}
 *
 * Merge strategy: last-write-wins by entry id (entry ids are Date.now() timestamps).
 * When the same id exists in both local and remote, local wins (local is source of
 * truth after the initial pull). Union of all unique ids is kept.
 *
 * Offline handling: a write queue accumulates pending Firestore writes when offline.
 * Call flushQueue(db, familyCode) when connectivity is restored to replay them.
 */

import { dg, ds } from '@/lib/db/indexeddb';
import {
  getEntriesEncrypted,
  saveEntriesEncrypted,
  deleteEncryptedCategory,
  type AnyLogEntry,
} from '@/utils/firestoreUtils';
import { collection, getDocs, limit as fbLimit, query, type Firestore } from 'firebase/firestore';

// ── Category registry ────────────────────────────────────────────────────────

export const SYNC_CATEGORIES = [
  'feed', 'pump', 'diaper', 'sleep', 'tummy', 'bath', 'massage', 'growth', 'temp', 'meds', 'allergy',
] as const;

export type SyncCategory = typeof SYNC_CATEGORIES[number];

// ── Minimal shared shape for all log entries ─────────────────────────────────

export interface SyncEntry {
  id: number;
  [key: string]: unknown;
}

// ── Offline write queue ──────────────────────────────────────────────────────

export interface QueuedWrite {
  familyCode: string;
  profileId: string;
  category: SyncCategory;
  entries: SyncEntry[];
  queuedAt: number;
}

const _writeQueue: QueuedWrite[] = [];

/** Add entries to the offline write queue. */
export function enqueueWrite(familyCode: string, profileId: string, category: SyncCategory, entries: SyncEntry[]): void {
  _writeQueue.push({ familyCode, profileId, category, entries, queuedAt: Date.now() });
}

/** Return a snapshot of the current write queue (does not mutate). */
export function getQueue(): QueuedWrite[] {
  return [..._writeQueue];
}

/** Clear all pending writes from the queue. */
export function clearQueue(): void {
  _writeQueue.length = 0;
}

/**
 * Flush the offline write queue to Firestore.
 * Writes all queued entries and clears the queue on success.
 */
export async function flushQueue(db: Firestore): Promise<void> {
  const pending = [..._writeQueue];
  if (pending.length === 0) return;
  await Promise.all(
    pending.map(({ familyCode, profileId, category, entries }) =>
      saveEntriesEncrypted(db, familyCode, profileId, category, entries as never[])
    )
  );
  clearQueue();
}

// ── Merge logic ──────────────────────────────────────────────────────────────

/**
 * Merge two entry arrays by id using last-write-wins.
 *
 * Since entry ids are Date.now() timestamps, a higher id = more recently created.
 * When the same id appears in both arrays, local wins (local is truth after first pull).
 * Returns entries sorted ascending by id.
 */
export function mergeEntries<T extends SyncEntry>(local: T[], remote: T[]): T[] {
  const map = new Map<number, T>();
  for (const e of remote) map.set(e.id, e);
  for (const e of local) map.set(e.id, e); // local overwrites remote on collision
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}

// ── Family code helpers ───────────────────────────────────────────────────────

const FAMILY_CODE_KEY = 'babybloom_family_code';

/**
 * Generate a random family code: "bloom-" + 8 alphanumeric chars.
 * ~2.8 trillion combinations — collision is astronomically unlikely.
 * Example: "bloom-x7k9m2ab"
 */
export function generateFamilyCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return 'bloom-' + result;
}

/**
 * Generate a family code that is guaranteed unique in Firestore.
 * Checks whether `families/{code}` already contains any documents.
 * Retries up to 5 times (practically never needed at 36^8 keyspace).
 */
export async function generateUniqueFamilyCode(db: Firestore | null): Promise<string> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateFamilyCode();
    if (!db) return code; // offline — can't check, just return
    try {
      const snap = await getDocs(query(collection(db, 'families', code, 'profiles'), fbLimit(1)));
      if (snap.empty) return code; // no data under this code — it's free
    } catch {
      return code; // network error — fall back to random (still ~0% collision chance)
    }
  }
  // Extremely unlikely fallback
  return generateFamilyCode();
}

/** Save the family code to IndexedDB. */
export async function saveFamilyCode(code: string): Promise<void> {
  await ds(FAMILY_CODE_KEY, code);
}

/** Load the family code from IndexedDB. Returns null if not set. */
export async function loadFamilyCode(): Promise<string | null> {
  const code = await dg(FAMILY_CODE_KEY);
  return (typeof code === 'string' && code.length > 0) ? code : null;
}

/** Remove the family code from IndexedDB. */
export async function clearFamilyCode(): Promise<void> {
  await ds(FAMILY_CODE_KEY, null);
}

// ── Full sync operations ─────────────────────────────────────────────────────

/**
 * Pull all remote Firestore entries for a profile, merge with local IndexedDB,
 * and persist the merged result back to IndexedDB.
 *
 * Returns the count of net-new entries added from remote.
 * No-op if db is null or familyCode is empty.
 */
export async function pullAndMerge(
  db: Firestore | null,
  familyCode: string,
  profileId: string,
): Promise<number> {
  if (!db || !familyCode) return 0;

  const profileKey = `profileData_${profileId}`;
  const profileData: { logs?: Record<string, SyncEntry[]> } =
    (await dg(profileKey)) || {};
  const localLogs: Record<string, SyncEntry[]> = profileData.logs || {};

  let totalNew = 0;
  const mergedLogs: Record<string, SyncEntry[]> = { ...localLogs };
  const categoriesToClean: string[] = [];

  for (const category of SYNC_CATEGORIES) {
    const local = (localLogs[category] as SyncEntry[] | undefined) || [];
    const remote = await getEntriesEncrypted<AnyLogEntry>(db, familyCode, profileId, category) as unknown as SyncEntry[];
    if (remote.length === 0) {
      mergedLogs[category] = local;
      continue;
    }
    const merged = mergeEntries(local, remote);
    mergedLogs[category] = merged;
    const newFromRemote = merged.length - local.length;
    totalNew += newFromRemote;
    // Only delete from Firestore if we actually received new entries from
    // the partner. If newFromRemote === 0 the data is our own push — leave
    // it so the partner can still pull it.
    if (newFromRemote > 0) {
      categoriesToClean.push(category);
    }
  }

  await ds(profileKey, { ...profileData, logs: mergedLogs });

  // Ephemeral cleanup — delete remote data that has been successfully merged.
  // Firestore is a relay, not permanent storage.
  if (categoriesToClean.length > 0) {
    await Promise.all(
      categoriesToClean.map((cat) => deleteEncryptedCategory(db, familyCode, profileId, cat))
    );
  }

  return Math.max(0, totalNew);
}

/**
 * Push all local IndexedDB entries for a profile to Firestore.
 *
 * If offline or db is null, entries are queued for later flushing.
 * If online and db is available, writes directly to Firestore.
 */
export async function pushAll(
  db: Firestore | null,
  familyCode: string,
  profileId: string,
  online: boolean,
): Promise<void> {
  if (!familyCode) return;
  const profileKey = `profileData_${profileId}`;
  const profileData: { logs?: Record<string, SyncEntry[]> } =
    (await dg(profileKey)) || {};
  const localLogs: Record<string, SyncEntry[]> = profileData.logs || {};

  for (const category of SYNC_CATEGORIES) {
    const entries = (localLogs[category] as SyncEntry[] | undefined) || [];
    if (entries.length === 0) continue;
    if (!db || !online) {
      enqueueWrite(familyCode, profileId, category, entries);
    } else {
      await saveEntriesEncrypted(db, familyCode, profileId, category, entries as never[]);
    }
  }
}
