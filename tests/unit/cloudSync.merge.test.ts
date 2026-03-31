/**
 * BabyBloom Cloud Sync — Merge Algorithm Tests
 *
 * 38 test cases covering every merge rule in the design document:
 *   - Log entry LWW (Last-Write-Wins) by modified_at
 *   - Fuzzy dedup (same date + type + time within 2 min)
 *   - Soft-delete tombstones and propagation
 *   - Delete-vs-edit race condition resolution
 *   - Tombstone purge after 30 days
 *   - Profile LWW (strict: latest wins entirely)
 *   - Milestone/vaccine "once-checked-always-checked"
 *   - Teeth "earliest date wins"
 *   - Firsts LWW
 *   - Emergency contacts LWW
 *   - Full snapshot merge
 *   - backfillModifiedAt migration
 *   - filterDeleted UI helper
 *   - Clock skew detection
 *   - Edge cases: empty arrays, missing IDs, identical timestamps
 */

import { describe, it, expect } from 'vitest';
import {
  mergeLogEntries,
  mergeProfile,
  mergeBooleanFlags,
  mergeVaccines,
  mergeTeeth,
  mergeFirsts,
  mergeEmergencyContacts,
  mergeSnapshots,
  softDelete,
  restoreEntry,
  resolveDeleteVsEdit,
  backfillModifiedAt,
  filterDeleted,
} from '@/lib/sync/merge';
import type { SyncFeedEntry, SyncProfile, SyncFirstEntry, StateSnapshot } from '@/lib/sync/types';
import { TOMBSTONE_PURGE_DAYS } from '@/lib/sync/types';

// ═══ HELPERS ═══

const t = (iso: string) => iso; // alias for readability
const TS_OLD  = '2026-01-01T10:00:00.000Z';
const TS_NEW  = '2026-01-01T11:00:00.000Z';
const TS_NEWER = '2026-01-01T12:00:00.000Z';
// Recent timestamp for tombstone tests — must stay within TOMBSTONE_PURGE_DAYS (30) of today
const TS_RECENT_DELETE = new Date(Date.now() - 60_000).toISOString(); // 1 minute ago

function feed(
  id: number,
  date: string,
  time: string,
  modified_at: string,
  opts: Partial<SyncFeedEntry> = {},
): SyncFeedEntry {
  return { id, date, time, type: 'Formula', modified_at, deleted_at: null, ...opts };
}

function makeSnapshot(
  deviceId: string,
  overrides: Partial<StateSnapshot> = {},
): StateSnapshot {
  return {
    schema_version: 2,
    device_id: deviceId,
    device_name: `Device ${deviceId}`,
    snapshot_at: new Date().toISOString(),
    profile: { name: 'Baby', modified_at: TS_OLD },
    logs: {
      feed: [], diaper: [], sleep: [], growth: [], temp: [],
      bath: [], massage: [], meds: [], allergy: [],
    },
    firsts: [],
    teeth: {},
    milestones: {},
    vaccines: {},
    emergency_contacts: [],
    ...overrides,
  };
}

// Expire a tombstone by backdating deleted_at beyond 30 days
function expiredTombstone(entry: SyncFeedEntry): SyncFeedEntry {
  const old = new Date();
  old.setDate(old.getDate() - (TOMBSTONE_PURGE_DAYS + 1));
  return { ...entry, deleted_at: old.toISOString() };
}

// ═══════════════════════════════════════════════════════
// GROUP 1: LOG ENTRY MERGE — LWW
// ═══════════════════════════════════════════════════════

describe('mergeLogEntries — LWW', () => {
  it('1. single device: returns entries unchanged', () => {
    const entries = [feed(1, '2026-01-01', '10:00', TS_OLD)];
    expect(mergeLogEntries(entries)).toEqual(entries);
  });

  it('2. no conflict: union of disjoint entries from two devices', () => {
    const a = [feed(1, '2026-01-01', '10:00', TS_OLD)];
    const b = [feed(2, '2026-01-01', '11:00', TS_NEW)];
    const result = mergeLogEntries(a, b);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id).sort()).toEqual([1, 2]);
  });

  it('3. same ID on both devices: keeps latest modified_at', () => {
    const a = [feed(1, '2026-01-01', '10:00', TS_OLD, { oz: 3 })];
    const b = [feed(1, '2026-01-01', '10:00', TS_NEW, { oz: 4 })];
    const result = mergeLogEntries(a, b);
    expect(result).toHaveLength(1);
    expect(result[0].oz).toBe(4);  // newer wins
    expect(result[0].modified_at).toBe(TS_NEW);
  });

  it('4. same ID: older device does not override newer', () => {
    const newer = [feed(1, '2026-01-01', '10:00', TS_NEW, { oz: 5 })];
    const older = [feed(1, '2026-01-01', '10:00', TS_OLD, { oz: 3 })];
    const result = mergeLogEntries(newer, older);
    expect(result[0].oz).toBe(5);
  });

  it('5. three devices: latest modified_at across all wins', () => {
    const a = [feed(1, '2026-01-01', '10:00', TS_OLD, { oz: 1 })];
    const b = [feed(1, '2026-01-01', '10:00', TS_NEW, { oz: 2 })];
    const c = [feed(1, '2026-01-01', '10:00', TS_NEWER, { oz: 3 })];
    const result = mergeLogEntries(a, b, c);
    expect(result).toHaveLength(1);
    expect(result[0].oz).toBe(3);
  });

  it('6. empty arrays: returns empty', () => {
    expect(mergeLogEntries([], [])).toEqual([]);
    expect(mergeLogEntries()).toEqual([]);
    expect(mergeLogEntries(undefined, undefined)).toEqual([]);
  });

  it('7. entries sorted date desc then time desc', () => {
    const entries = [
      feed(1, '2026-01-01', '08:00', TS_OLD),
      feed(2, '2026-01-02', '09:00', TS_OLD),
      feed(3, '2026-01-01', '14:00', TS_OLD),
    ];
    const result = mergeLogEntries(entries);
    expect(result[0].date).toBe('2026-01-02');  // latest date first
    expect(result[1].time).toBe('14:00');       // then later time
    expect(result[2].time).toBe('08:00');
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 2: FUZZY DEDUP
// ═══════════════════════════════════════════════════════

describe('mergeLogEntries — fuzzy dedup', () => {
  it('8. same date+type within 2 min: keeps latest modified_at', () => {
    // Both parents log Feed at 10:00 and 10:01 — same event
    const a = [feed(1, '2026-01-01', '10:00', TS_OLD, { type: 'Formula' })];
    const b = [feed(2, '2026-01-01', '10:01', TS_NEW, { type: 'Formula' })];
    const result = mergeLogEntries(a, b);
    // Should dedup to 1 entry (within 2-min window)
    expect(result).toHaveLength(1);
    expect(result[0].modified_at).toBe(TS_NEW);
  });

  it('9. same date+type > 2 min apart: both kept (separate events)', () => {
    const a = [feed(1, '2026-01-01', '10:00', TS_OLD, { type: 'Formula' })];
    const b = [feed(2, '2026-01-01', '10:03', TS_NEW, { type: 'Formula' })];
    const result = mergeLogEntries(a, b);
    expect(result).toHaveLength(2);
  });

  it('10. same ID counts as fuzzy match regardless of time delta', () => {
    const a = [feed(5, '2026-01-01', '10:00', TS_OLD)];
    const b = [feed(5, '2026-01-01', '11:00', TS_NEW)];  // same ID, different time
    const result = mergeLogEntries(a, b);
    expect(result).toHaveLength(1);  // ID match → same entry
  });

  it('11. different type on same date: not fuzzy duped', () => {
    const a = [feed(1, '2026-01-01', '10:00', TS_OLD, { type: 'Formula' })];
    const b = [feed(2, '2026-01-01', '10:01', TS_NEW, { type: 'Breast L' })];
    const result = mergeLogEntries(a, b);
    expect(result).toHaveLength(2);  // different type → different events
  });

  it('12. fuzzy dedup: winner is the one with later modified_at', () => {
    const older = [feed(1, '2026-01-01', '10:00', TS_OLD, { oz: 2 })];
    const newer = [feed(2, '2026-01-01', '10:01', TS_NEW, { oz: 4 })];
    const result = mergeLogEntries(older, newer);
    expect(result[0].oz).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 3: SOFT DELETES / TOMBSTONES
// ═══════════════════════════════════════════════════════

describe('mergeLogEntries — tombstones', () => {
  it('13. soft-deleted entry propagates to merge result', () => {
    const withDelete = [feed(1, '2026-01-01', '10:00', TS_RECENT_DELETE, { deleted_at: TS_RECENT_DELETE })];
    const withoutDelete = [feed(1, '2026-01-01', '10:00', TS_OLD)];
    const result = mergeLogEntries(withDelete, withoutDelete);
    expect(result).toHaveLength(1);
    expect(result[0].deleted_at).toBeTruthy();
  });

  it('14. active entry from one device does not un-delete tombstone', () => {
    // Device A deleted (newer), Device B still has active (older) — delete should win
    const deviceA = [feed(1, '2026-01-01', '10:00', TS_RECENT_DELETE, { deleted_at: TS_RECENT_DELETE })];
    const deviceB = [feed(1, '2026-01-01', '10:00', TS_OLD)];  // older, no delete
    const result = mergeLogEntries(deviceA, deviceB);
    expect(result[0].deleted_at).toBeTruthy();
  });

  it('15. expired tombstone (> 30 days) is permanently purged from merge result', () => {
    const expired = [expiredTombstone(feed(1, '2026-01-01', '10:00', TS_OLD))];
    const result = mergeLogEntries(expired);
    expect(result).toHaveLength(0);
  });

  it('16. recent tombstone (< 30 days) is retained', () => {
    const recentDelete = [feed(1, '2026-01-01', '10:00', TS_RECENT_DELETE, { deleted_at: TS_RECENT_DELETE })];
    const result = mergeLogEntries(recentDelete);
    expect(result).toHaveLength(1);
    expect(result[0].deleted_at).toBeTruthy();
  });

  it('17. softDelete helper sets deleted_at and updates modified_at', () => {
    const entry = feed(1, '2026-01-01', '10:00', TS_OLD);
    const deleted = softDelete(entry);
    expect(deleted.deleted_at).toBeTruthy();
    expect(deleted.modified_at).not.toBe(TS_OLD);
    expect(new Date(deleted.modified_at).getTime()).toBeGreaterThan(new Date(TS_OLD).getTime());
  });

  it('18. restoreEntry helper clears deleted_at', () => {
    const entry = feed(1, '2026-01-01', '10:00', TS_NEW, { deleted_at: TS_NEW });
    const restored = restoreEntry(entry);
    expect(restored.deleted_at).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 4: DELETE vs EDIT RACE CONDITION (§8.2.4)
// ═══════════════════════════════════════════════════════

describe('resolveDeleteVsEdit — race condition', () => {
  it('19. delete is newer: delete wins', () => {
    const deleted = feed(1, '2026-01-01', '10:00', TS_NEW, { deleted_at: TS_NEW, oz: 3 });
    const edited  = feed(1, '2026-01-01', '10:00', TS_OLD, { oz: 5 });
    const result = resolveDeleteVsEdit(deleted, edited);
    expect(result.deleted_at).toBeTruthy();
  });

  it('20. edit is newer: entry restored with edit applied', () => {
    const deleted = feed(1, '2026-01-01', '10:00', TS_OLD, { deleted_at: TS_OLD, oz: 3 });
    const edited  = feed(1, '2026-01-01', '10:00', TS_NEW, { oz: 5 });
    const result = resolveDeleteVsEdit(deleted, edited);
    expect(result.deleted_at).toBeNull();
    expect(result.oz).toBe(5);
  });

  it('21. delete_at same as edit modified_at: delete wins (conservative)', () => {
    const deleted = feed(1, '2026-01-01', '10:00', TS_NEW, { deleted_at: TS_NEW });
    const edited  = feed(1, '2026-01-01', '10:00', TS_NEW, { oz: 5 });
    const result = resolveDeleteVsEdit(deleted, edited);
    expect(result.deleted_at).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 5: PROFILE MERGE
// ═══════════════════════════════════════════════════════

describe('mergeProfile', () => {
  it('22. remote profile newer: remote wins entirely', () => {
    const local:  SyncProfile = { name: 'Alice', modified_at: TS_OLD };
    const remote: SyncProfile = { name: 'Baby Alice', modified_at: TS_NEW };
    const { profile, changed } = mergeProfile(local, remote);
    expect(profile.name).toBe('Baby Alice');
    expect(changed).toBe(true);
  });

  it('23. local profile newer: local wins', () => {
    const local:  SyncProfile = { name: 'Baby', modified_at: TS_NEW };
    const remote: SyncProfile = { name: 'Old Name', modified_at: TS_OLD };
    const { profile, changed } = mergeProfile(local, remote);
    expect(profile.name).toBe('Baby');
    expect(changed).toBe(false);
  });

  it('24. same modified_at: local wins (no change)', () => {
    const local:  SyncProfile = { name: 'Baby', modified_at: TS_OLD };
    const remote: SyncProfile = { name: 'Baby', modified_at: TS_OLD };
    const { changed } = mergeProfile(local, remote);
    expect(changed).toBe(false);
  });

  it('25. multiple remotes: latest modified_at wins', () => {
    const local:   SyncProfile = { name: 'A', modified_at: TS_OLD };
    const remote1: SyncProfile = { name: 'B', modified_at: TS_NEW };
    const remote2: SyncProfile = { name: 'C', modified_at: TS_NEWER };
    const { profile } = mergeProfile(local, remote1, remote2);
    expect(profile.name).toBe('C');
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 6: MILESTONES / VACCINES — once checked, always checked
// ═══════════════════════════════════════════════════════

describe('mergeBooleanFlags — milestones', () => {
  it('26. true from any device propagates to merge result', () => {
    const a = { 'motor_0': true };
    const b = { 'motor_0': false };  // B hasn't checked it yet
    const result = mergeBooleanFlags(a, b);
    expect(result['motor_0']).toBe(true);
  });

  it('27. false from both: stays false', () => {
    const a = { 'motor_0': false };
    const b = { 'motor_0': false };
    const result = mergeBooleanFlags(a, b);
    expect(result['motor_0']).toBe(false);
  });

  it('28. union of all keys from all devices', () => {
    const a = { 'motor_0': true };
    const b = { 'social_0': true };
    const result = mergeBooleanFlags(a, b);
    expect(result['motor_0']).toBe(true);
    expect(result['social_0']).toBe(true);
  });

  it('29. mergeVaccines: true from any country/schedule propagates', () => {
    const a = { US: { '0_0': true, '0_1': false } };
    const b = { US: { '0_0': false, '0_1': true }, IN: { '0_0': true } };
    const result = mergeVaccines(a, b);
    expect(result.US['0_0']).toBe(true);
    expect(result.US['0_1']).toBe(true);
    expect(result.IN['0_0']).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 7: TEETH — earliest date wins
// ═══════════════════════════════════════════════════════

describe('mergeTeeth', () => {
  it('30. tooth in both devices: earliest date wins', () => {
    const a = { '0': '2026-02-15' };
    const b = { '0': '2026-01-10' };  // earlier
    const result = mergeTeeth(a, b);
    expect(result['0']).toBe('2026-01-10');
  });

  it('31. tooth only in one device: that date accepted', () => {
    const a = { '0': '2026-01-15' };
    const b = {};
    const result = mergeTeeth(a, b);
    expect(result['0']).toBe('2026-01-15');
  });

  it('32. multiple teeth: each gets earliest date independently', () => {
    const a = { '0': '2026-01-15', '1': '2026-03-01' };
    const b = { '0': '2026-01-10', '1': '2026-03-15' };
    const result = mergeTeeth(a, b);
    expect(result['0']).toBe('2026-01-10');  // earlier
    expect(result['1']).toBe('2026-03-01');  // earlier
  });

  it('33. empty maps: returns empty', () => {
    expect(mergeTeeth({}, {})).toEqual({});
    expect(mergeTeeth()).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 8: FIRSTS & EMERGENCY CONTACTS — LWW
// ═══════════════════════════════════════════════════════

describe('mergeFirsts', () => {
  it('34. same ID: latest modified_at wins', () => {
    const a: SyncFirstEntry[] = [{ id: 1, label: 'First smile', modified_at: TS_OLD }];
    const b: SyncFirstEntry[] = [{ id: 1, label: 'First smile!', modified_at: TS_NEW }];
    const result = mergeFirsts(a, b);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('First smile!');
  });

  it('35. deleted first is hidden (tombstone retained)', () => {
    const a: SyncFirstEntry[] = [{ id: 1, label: 'First smile', modified_at: TS_RECENT_DELETE, deleted_at: TS_RECENT_DELETE }];
    const result = mergeFirsts(a);
    expect(result).toHaveLength(1);
    expect(result[0].deleted_at).toBeTruthy();
  });
});

describe('mergeEmergencyContacts', () => {
  it('36. latest contact wins by modified_at', () => {
    const a = [{ id: 1, name: 'Dr. Smith', phone: '555-1111', modified_at: TS_OLD }];
    const b = [{ id: 1, name: 'Dr. Smith', phone: '555-2222', modified_at: TS_NEW }];
    const result = mergeEmergencyContacts(a, b);
    expect(result[0].phone).toBe('555-2222');
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 9: FULL SNAPSHOT MERGE
// ═══════════════════════════════════════════════════════

describe('mergeSnapshots', () => {
  it('37. merges logs from two devices correctly', () => {
    const local = makeSnapshot('A', {
      logs: {
        feed: [feed(1, '2026-01-01', '08:00', TS_OLD, { oz: 3 })],
        diaper: [], sleep: [], growth: [], temp: [],
        bath: [], massage: [], meds: [], allergy: [],
      },
    });
    const remote = makeSnapshot('B', {
      logs: {
        feed: [feed(2, '2026-01-01', '09:00', TS_NEW, { oz: 4 })],
        diaper: [], sleep: [], growth: [], temp: [],
        bath: [], massage: [], meds: [], allergy: [],
      },
    });
    const result = mergeSnapshots(local, remote);
    expect(result.snapshot.logs.feed).toHaveLength(2);
    expect(result.newEntryCount).toBe(1);
  });

  it('38. clock skew reported when remote snapshot is significantly offset', () => {
    const local = makeSnapshot('A');
    const farFuture = makeSnapshot('B', {
      snapshot_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min in future
    });
    const result = mergeSnapshots(local, farFuture);
    expect(result.clockSkewMs).toBeGreaterThan(2 * 60 * 1000); // > 2 min
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 10: MIGRATION & UTILITY HELPERS
// ═══════════════════════════════════════════════════════

describe('backfillModifiedAt', () => {
  it('39. entries without modified_at get backfilled from date+time', () => {
    const entries = [{ id: 1, date: '2026-01-15', time: '10:30' }];
    const result = backfillModifiedAt(entries);
    expect(result[0].modified_at).toBeTruthy();
    expect(result[0].deleted_at).toBeNull();
  });

  it('40. entries with existing modified_at are not changed', () => {
    const entries = [{ id: 1, date: '2026-01-15', time: '10:30', modified_at: TS_OLD }];
    const result = backfillModifiedAt(entries);
    expect(result[0].modified_at).toBe(TS_OLD);
  });
});

describe('filterDeleted', () => {
  it('41. removes entries with deleted_at set', () => {
    const entries = [
      feed(1, '2026-01-01', '10:00', TS_OLD),
      feed(2, '2026-01-01', '11:00', TS_NEW, { deleted_at: TS_NEW }),
    ];
    const result = filterDeleted(entries);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('42. keeps entries with deleted_at = null', () => {
    const entries = [feed(1, '2026-01-01', '10:00', TS_OLD, { deleted_at: null })];
    expect(filterDeleted(entries)).toHaveLength(1);
  });
});
