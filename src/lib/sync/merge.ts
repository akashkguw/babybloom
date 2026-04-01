/**
 * BabyBloom Cloud Sync — Deterministic Merge Algorithm
 *
 * Pure function: given N device state snapshots, produces a single unified state.
 * Deterministic: same inputs → same output regardless of which device runs it.
 *
 * Rules per data type:
 *   Log entries:         LWW by modified_at, fuzzy dedup (2-min window), tombstones
 *   Profile:             Strict LWW by modified_at — latest wins entirely
 *   Milestones/vaccines: "once-checked-always-checked" — checked state never reverts
 *   Teeth:               Earliest eruption date wins (tooth can't un-erupt)
 *   Firsts:              LWW by modified_at
 *   Emergency contacts:  LWW by modified_at
 */

import type {
  StateSnapshot,
  SyncLogEntry,
  SyncProfile,
  SyncFirstEntry,
  SyncEmergencyContact,
  SyncLogs,
} from './types';
import { FUZZY_DEDUP_WINDOW_MS, TOMBSTONE_PURGE_DAYS } from './types';

// ═══ HELPERS ═══

/**
 * Compare two ISO 8601 timestamps. Returns positive if a > b.
 */
function cmpTime(a: string | undefined, b: string | undefined): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.localeCompare(b);
}

/**
 * Parse "HH:MM" to minutes-since-midnight. Returns -1 if unparseable.
 */
function timeToMinutes(t?: string): number {
  if (!t) return -1;
  const parts = t.split(':');
  if (parts.length < 2) return -1;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
}

/**
 * Convert YYYY-MM-DD + HH:MM to epoch milliseconds. Returns 0 if unparseable.
 */
function entryToMs(date?: string, time?: string): number {
  if (!date) return 0;
  const t = time || '00:00';
  try {
    return new Date(`${date}T${t}:00`).getTime();
  } catch {
    return 0;
  }
}

/**
 * Check if two entries are likely the same event via fuzzy dedup:
 * same date, same type, and time within FUZZY_DEDUP_WINDOW_MS.
 */
function isFuzzyDuplicate(a: SyncLogEntry, b: SyncLogEntry): boolean {
  if (a.date !== b.date) return false;
  if (a.type !== b.type) return false;
  if (a.id === b.id) return true; // same ID → definitely same

  const msA = entryToMs(a.date, a.time);
  const msB = entryToMs(b.date, b.time);

  // If times can't be parsed, fall back to exact match
  if (msA === 0 || msB === 0) return false;

  return Math.abs(msA - msB) <= FUZZY_DEDUP_WINDOW_MS;
}

/**
 * Check if a tombstone is old enough to be purged (> TOMBSTONE_PURGE_DAYS).
 */
function isExpiredTombstone(deleted_at?: string | null): boolean {
  if (!deleted_at) return false;
  const deletedMs = new Date(deleted_at).getTime();
  const purgeMs = TOMBSTONE_PURGE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - deletedMs > purgeMs;
}

// ═══ LOG ENTRY MERGE ═══

/**
 * Merge an array of log entries from multiple devices.
 * Algorithm:
 *   1. Collect all entries from all device snapshots into a pool.
 *   2. Deduplicate by ID: for same ID, keep latest modified_at (LWW).
 *   3. Fuzzy dedup (cross-device only): same date + type + time within 2 min
 *      → keep latest modified_at. Entries from the same device are NEVER
 *      fuzzy-deduped against each other, because a single parent may
 *      legitimately log multiple events close together.
 *   4. Apply tombstones: deleted_at set → hidden (purge if > 30 days old).
 *   5. Sort: date desc, time desc.
 */
export function mergeLogEntries<T extends SyncLogEntry>(
  ...deviceArrays: Array<T[] | undefined>
): T[] {
  // Step 1: Collect all entries, keyed by ID.
  // Also track which device array each entry came from so we can skip
  // fuzzy dedup within the same device (two entries from one parent
  // on the same date within 2 min are valid, not duplicates).
  const byId = new Map<number, T>();
  const entrySource = new Map<number, number>(); // entry.id → deviceArrayIndex

  for (let deviceIdx = 0; deviceIdx < deviceArrays.length; deviceIdx++) {
    const arr = deviceArrays[deviceIdx];
    if (!arr) continue;
    for (const entry of arr) {
      if (entry.id == null) continue;

      const existing = byId.get(entry.id);
      if (!existing) {
        byId.set(entry.id, { ...entry });
        entrySource.set(entry.id, deviceIdx);
      } else {
        // LWW: keep latest modified_at
        if (cmpTime(entry.modified_at, existing.modified_at) > 0) {
          byId.set(entry.id, { ...entry });
          entrySource.set(entry.id, deviceIdx);
        } else if (
          cmpTime(entry.modified_at, existing.modified_at) === 0 &&
          entry.deleted_at && !existing.deleted_at
        ) {
          // Same modified_at but this one has a delete — delete wins for safety
          byId.set(entry.id, { ...entry });
          entrySource.set(entry.id, deviceIdx);
        }
      }
    }
  }

  // Step 2: Fuzzy dedup — ONLY across different devices.
  // Two entries from the same parent are always distinct events.
  // Two entries from different parents on the same date + type + ~time
  // are likely the same event logged by both parents.
  const entries = Array.from(byId.values());
  const dominated = new Set<number>();

  for (let i = 0; i < entries.length; i++) {
    if (dominated.has(entries[i].id)) continue;
    for (let j = i + 1; j < entries.length; j++) {
      if (dominated.has(entries[j].id)) continue;
      // Never fuzzy-dedup entries that originated from the same device
      if (entrySource.get(entries[i].id) === entrySource.get(entries[j].id)) continue;
      if (isFuzzyDuplicate(entries[i], entries[j])) {
        // Keep the one with later modified_at; dominate the other
        if (cmpTime(entries[i].modified_at, entries[j].modified_at) >= 0) {
          dominated.add(entries[j].id);
        } else {
          dominated.add(entries[i].id);
          break; // entries[i] is dominated, move to next i
        }
      }
    }
  }

  // Step 3: Filter out dominated and expired tombstones; keep active tombstones
  const result = entries.filter((e) => {
    if (dominated.has(e.id)) return false;
    if (isExpiredTombstone(e.deleted_at)) return false;
    return true;
  });

  // Step 4: Sort — date desc, time desc
  result.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const ta = timeToMinutes(a.time);
    const tb = timeToMinutes(b.time);
    if (ta !== -1 && tb !== -1) return tb - ta;
    return (b.time || '').localeCompare(a.time || '');
  });

  return result;
}

// ═══ PROFILE MERGE ═══

/**
 * Strict LWW for profile: the profile with the latest modified_at wins entirely.
 * Returns { profile, changed } where changed=true means the local profile was updated.
 */
export function mergeProfile(
  localProfile: SyncProfile,
  ...remoteProfiles: Array<SyncProfile | undefined>
): { profile: SyncProfile; changed: boolean } {
  let winner = localProfile;

  for (const remote of remoteProfiles) {
    if (!remote) continue;
    if (cmpTime(remote.modified_at, winner.modified_at) > 0) {
      winner = remote;
    }
  }

  const changed = winner !== localProfile;
  return { profile: winner, changed };
}

// ═══ MILESTONE / VACCINE MERGE ═══

/**
 * "Once checked, always checked" — boolean flags that can never revert.
 * A milestone/vaccine marked as true on any device remains true forever.
 */
export function mergeBooleanFlags(
  ...deviceMaps: Array<Record<string, boolean> | undefined>
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  for (const map of deviceMaps) {
    if (!map) continue;
    for (const [key, val] of Object.entries(map)) {
      // Once true, stays true
      if (val === true || result[key] !== true) {
        result[key] = val || result[key] || false;
      }
    }
  }

  return result;
}

/**
 * Merge vaccine maps nested by country code.
 * vaccines: { US: { '0_0': true, ... }, IN: { ... } }
 */
export function mergeVaccines(
  ...deviceMaps: Array<Record<string, Record<string, boolean>> | undefined>
): Record<string, Record<string, boolean>> {
  const result: Record<string, Record<string, boolean>> = {};

  for (const map of deviceMaps) {
    if (!map) continue;
    for (const [country, schedule] of Object.entries(map)) {
      if (!schedule || typeof schedule !== 'object') continue;
      if (!result[country]) result[country] = {};
      for (const [key, val] of Object.entries(schedule)) {
        if (val === true) result[country][key] = true;
        else if (result[country][key] !== true) result[country][key] = val;
      }
    }
  }

  return result;
}

// ═══ TEETH MERGE ═══

/**
 * Earliest eruption date wins — a tooth can't un-erupt.
 * teeth: { "0": "2026-01-15", "1": "2026-02-10", ... }
 */
export function mergeTeeth(
  ...deviceMaps: Array<Record<string, string> | undefined>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const map of deviceMaps) {
    if (!map) continue;
    for (const [tooth, date] of Object.entries(map)) {
      if (!date) continue;
      if (!result[tooth]) {
        result[tooth] = date;
      } else {
        // Earliest date wins
        if (date.localeCompare(result[tooth]) < 0) {
          result[tooth] = date;
        }
      }
    }
  }

  return result;
}

// ═══ FIRSTS MERGE ═══

/**
 * Merge baby's first entries — LWW by modified_at.
 * Handles delete-beats-edit and edit-beats-delete race conditions per design.
 */
export function mergeFirsts(
  ...deviceArrays: Array<SyncFirstEntry[] | undefined>
): SyncFirstEntry[] {
  const byId = new Map<number, SyncFirstEntry>();

  for (const arr of deviceArrays) {
    if (!arr) continue;
    for (const entry of arr) {
      if (entry.id == null) continue;

      const existing = byId.get(entry.id);
      if (!existing) {
        byId.set(entry.id, { ...entry });
      } else {
        if (cmpTime(entry.modified_at, existing.modified_at) > 0) {
          byId.set(entry.id, { ...entry });
        }
      }
    }
  }

  const result = Array.from(byId.values()).filter(
    (e) => !isExpiredTombstone(e.deleted_at),
  );

  result.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return result;
}

// ═══ EMERGENCY CONTACTS MERGE ═══

/**
 * Emergency contacts — LWW by modified_at.
 */
export function mergeEmergencyContacts(
  ...deviceArrays: Array<SyncEmergencyContact[] | undefined>
): SyncEmergencyContact[] {
  const byId = new Map<number, SyncEmergencyContact>();

  for (const arr of deviceArrays) {
    if (!arr) continue;
    for (const contact of arr) {
      if (contact.id == null) continue;

      const existing = byId.get(contact.id);
      if (!existing) {
        byId.set(contact.id, { ...contact });
      } else {
        if (cmpTime(contact.modified_at, existing.modified_at) > 0) {
          byId.set(contact.id, { ...contact });
        }
      }
    }
  }

  return Array.from(byId.values()).filter((c) => !isExpiredTombstone(c.deleted_at));
}

// ═══ FULL STATE MERGE ═══

export interface MergeResult {
  snapshot: StateSnapshot;
  /** True if profile was updated from a remote device */
  profileChanged: boolean;
  /** Number of new entries added (not counting entries already present) */
  newEntryCount: number;
  /** Clock skew detected in ms (0 if within tolerance) */
  clockSkewMs: number;
}

/**
 * Merge multiple device state snapshots into a single unified snapshot.
 * This is the top-level merge function called by the sync engine.
 *
 * @param local - The local device's current snapshot
 * @param remotes - State snapshots from other devices
 * @returns MergeResult with the merged snapshot and metadata
 */
export function mergeSnapshots(
  local: StateSnapshot,
  ...remotes: StateSnapshot[]
): MergeResult {
  // ── Detect clock skew ──
  let clockSkewMs = 0;
  const now = Date.now();
  for (const remote of remotes) {
    try {
      const remoteTs = new Date(remote.snapshot_at).getTime();
      const skew = Math.abs(now - remoteTs);
      if (skew > clockSkewMs) clockSkewMs = skew;
    } catch {
      // ignore unparseable timestamps
    }
  }

  // ── Merge logs ──
  const allLogs = [local, ...remotes];

  const mergedLogs: SyncLogs = {
    feed:    mergeLogEntries(...allLogs.map((s) => s.logs.feed)),
    diaper:  mergeLogEntries(...allLogs.map((s) => s.logs.diaper)),
    sleep:   mergeLogEntries(...allLogs.map((s) => s.logs.sleep)),
    growth:  mergeLogEntries(...allLogs.map((s) => s.logs.growth)),
    temp:    mergeLogEntries(...allLogs.map((s) => s.logs.temp)),
    bath:    mergeLogEntries(...allLogs.map((s) => s.logs.bath)),
    massage: mergeLogEntries(...allLogs.map((s) => s.logs.massage)),
    meds:    mergeLogEntries(...allLogs.map((s) => s.logs.meds)),
    allergy: mergeLogEntries(...allLogs.map((s) => s.logs.allergy)),
    pump:    mergeLogEntries(...allLogs.map((s) => s.logs.pump)),
    tummy:   mergeLogEntries(...allLogs.map((s) => s.logs.tummy)),
  };

  // ── Merge profile ──
  const { profile: mergedProfile, changed: profileChanged } = mergeProfile(
    local.profile,
    ...remotes.map((s) => s.profile),
  );

  // ── Merge milestones ──
  const mergedMilestones = mergeBooleanFlags(
    ...allLogs.map((s) => s.milestones),
  );

  // ── Merge vaccines ──
  const mergedVaccines = mergeVaccines(
    ...allLogs.map((s) => s.vaccines),
  );

  // ── Merge teeth ──
  const mergedTeeth = mergeTeeth(
    ...allLogs.map((s) => s.teeth),
  );

  // ── Merge firsts ──
  const mergedFirsts = mergeFirsts(
    ...allLogs.map((s) => s.firsts),
  );

  // ── Merge emergency contacts ──
  const mergedContacts = mergeEmergencyContacts(
    ...allLogs.map((s) => s.emergency_contacts),
  );

  // ── Build merged snapshot ──
  const mergedSnapshot: StateSnapshot = {
    schema_version: 2,
    device_id: local.device_id,
    device_name: local.device_name,
    snapshot_at: new Date().toISOString(),
    profile: mergedProfile,
    logs: mergedLogs,
    firsts: mergedFirsts,
    teeth: mergedTeeth,
    milestones: mergedMilestones,
    vaccines: mergedVaccines,
    emergency_contacts: mergedContacts,
  };

  // Count new entries (excluding tombstones from remote)
  const mergedEntryCount = countEntries(mergedLogs, /* excludeDeleted */ true);
  const preMergeCount = countEntries(local.logs, /* excludeDeleted */ true);
  const newEntryCount = Math.max(0, mergedEntryCount - preMergeCount);

  return {
    snapshot: mergedSnapshot,
    profileChanged,
    newEntryCount,
    clockSkewMs,
  };
}

// ═══ DELETE / RESTORE HELPERS ═══

/**
 * Soft-delete an entry by setting deleted_at and updating modified_at.
 * The entry is NOT removed from the array — it becomes a tombstone.
 */
export function softDelete<T extends SyncLogEntry>(entry: T): T {
  const now = new Date().toISOString();
  return { ...entry, deleted_at: now, modified_at: now };
}

/**
 * Restore a soft-deleted entry by clearing deleted_at and updating modified_at.
 * Per design: if an edit arrives after a delete (edit.modified_at > deleted_at),
 * the entry is un-deleted.
 */
export function restoreEntry<T extends SyncLogEntry>(entry: T): T {
  const now = new Date().toISOString();
  return { ...entry, deleted_at: null, modified_at: now };
}

/**
 * Resolve the delete-vs-edit race condition per design §8.2.4:
 * - If deleted_at > edit's modified_at → delete wins
 * - If edit's modified_at > deleted_at → entry is restored with edit applied
 */
export function resolveDeleteVsEdit<T extends SyncLogEntry>(
  withDelete: T,
  withEdit: T,
): T {
  // Both must refer to the same entry ID
  if (!withDelete.deleted_at) return withEdit;

  const deleteTime = withDelete.deleted_at;
  const editTime = withEdit.modified_at;

  if (cmpTime(deleteTime, editTime) >= 0) {
    // Delete is later — delete wins
    return withDelete;
  } else {
    // Edit is later — restore the entry with the edit applied
    return { ...withEdit, deleted_at: null };
  }
}

// ═══ MIGRATION HELPERS ═══

/**
 * Backfill modified_at on existing log entries that predate cloud sync.
 * Sets modified_at = entry's date + time (or 'T00:00:00.000Z' if not available).
 * This migration is non-destructive and idempotent.
 */
export function backfillModifiedAt<T extends { id: number; date?: string; time?: string; modified_at?: string }>(
  entries: T[],
): (T & { modified_at: string; deleted_at: null })[] {
  return entries.map((e) => {
    if (e.modified_at) {
      return e as T & { modified_at: string; deleted_at: null };
    }
    const modified_at = e.date
      ? `${e.date}T${e.time || '00:00'}:00.000Z`
      : new Date(0).toISOString();
    return { ...e, modified_at, deleted_at: null };
  });
}

// ═══ UTILITY ═══

function countEntries(logs: SyncLogs, excludeDeleted = false): number {
  let count = 0;
  const categories = Object.values(logs);
  for (const arr of categories) {
    if (!Array.isArray(arr)) continue;
    for (const e of arr) {
      if (excludeDeleted && e.deleted_at) continue;
      count++;
    }
  }
  return count;
}

/**
 * Filter out soft-deleted entries for UI display.
 * Tombstones are retained in the database but hidden in the UI.
 */
export function filterDeleted<T extends { deleted_at?: string | null }>(entries: T[]): T[] {
  return entries.filter((e) => !e.deleted_at);
}
