/**
 * Unit tests for src/utils/syncService.ts
 *
 * All external dependencies (IndexedDB, firestoreUtils, Firestore) are mocked.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock @/lib/db/indexeddb ───────────────────────────────────────────────────
const mockStore: Record<string, unknown> = {};

vi.mock('@/lib/db/indexeddb', () => ({
  dg: vi.fn(async (key: string) => mockStore[key] ?? null),
  ds: vi.fn(async (key: string, val: unknown) => { mockStore[key] = val; }),
}));

// ── Mock @/utils/firestoreUtils ───────────────────────────────────────────────
const mockGetEntries = vi.fn(async (_db: unknown, _pid: unknown, _cat: unknown) => [] as { id: number; [key: string]: unknown }[]);
const mockSaveEntries = vi.fn(async (_db: unknown, _pid: unknown, _cat: unknown, _entries: unknown) => undefined);

vi.mock('@/utils/firestoreUtils', () => ({
  getEntries: (db: unknown, pid: unknown, cat: unknown) => mockGetEntries(db, pid, cat),
  saveEntries: (db: unknown, pid: unknown, cat: unknown, entries: unknown) => mockSaveEntries(db, pid, cat, entries),
}));

// ── Mock firebase/firestore (needed by firestoreUtils types) ──────────────────
vi.mock('firebase/firestore', () => ({}));

import {
  mergeEntries,
  enqueueWrite,
  getQueue,
  clearQueue,
  flushQueue,
  pullAndMerge,
  pushAll,
  SYNC_CATEGORIES,
} from '@/utils/syncService';

import { dg, ds } from '@/lib/db/indexeddb';

const mockDb = { _isMock: true } as never;

// ── helpers ───────────────────────────────────────────────────────────────────

function resetMockStore() {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
}

// ── SYNC_CATEGORIES ───────────────────────────────────────────────────────────

describe('SYNC_CATEGORIES', () => {
  it('contains all 10 expected categories', () => {
    const expected = ['feed', 'pump', 'diaper', 'sleep', 'bath', 'massage', 'growth', 'temp', 'meds', 'allergy'];
    expect(SYNC_CATEGORIES).toHaveLength(10);
    for (const cat of expected) {
      expect(SYNC_CATEGORIES).toContain(cat);
    }
  });
});

// ── mergeEntries ──────────────────────────────────────────────────────────────

describe('mergeEntries', () => {
  it('returns empty array when both inputs are empty', () => {
    expect(mergeEntries([], [])).toEqual([]);
  });

  it('returns local entries when remote is empty', () => {
    const local = [{ id: 1 }, { id: 2 }];
    expect(mergeEntries(local, [])).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('returns remote entries when local is empty', () => {
    const remote = [{ id: 3 }, { id: 4 }];
    expect(mergeEntries([], remote)).toEqual([{ id: 3 }, { id: 4 }]);
  });

  it('merges disjoint local and remote entries', () => {
    const local = [{ id: 1, type: 'feed' }];
    const remote = [{ id: 2, type: 'diaper' }];
    const result = mergeEntries(local, remote);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });

  it('deduplicates by id — local wins on collision (last-write-wins)', () => {
    const local = [{ id: 10, type: 'local-value' }];
    const remote = [{ id: 10, type: 'remote-value' }];
    const result = mergeEntries(local, remote);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('local-value');
  });

  it('returns entries sorted ascending by id', () => {
    const local = [{ id: 30 }, { id: 10 }];
    const remote = [{ id: 20 }, { id: 5 }];
    const result = mergeEntries(local, remote);
    expect(result.map((e) => e.id)).toEqual([5, 10, 20, 30]);
  });

  it('handles large mixed arrays correctly', () => {
    const local = Array.from({ length: 50 }, (_, i) => ({ id: i * 2 }));
    const remote = Array.from({ length: 50 }, (_, i) => ({ id: i * 2 + 1 }));
    const result = mergeEntries(local, remote);
    expect(result).toHaveLength(100);
    // Verify sorted
    for (let i = 1; i < result.length; i++) {
      expect(result[i].id).toBeGreaterThan(result[i - 1].id);
    }
  });
});

// ── Offline write queue ───────────────────────────────────────────────────────

describe('offline write queue', () => {
  beforeEach(() => {
    clearQueue();
  });

  it('getQueue returns empty array initially', () => {
    expect(getQueue()).toEqual([]);
  });

  it('enqueueWrite adds an item to the queue', () => {
    enqueueWrite('p1', 'feed', [{ id: 1 }]);
    const q = getQueue();
    expect(q).toHaveLength(1);
    expect(q[0].profileId).toBe('p1');
    expect(q[0].category).toBe('feed');
    expect(q[0].entries).toEqual([{ id: 1 }]);
  });

  it('getQueue returns a snapshot — mutations do not affect the internal queue', () => {
    enqueueWrite('p1', 'feed', [{ id: 1 }]);
    const q = getQueue();
    q.push({ profileId: 'x', category: 'diaper', entries: [], queuedAt: 0 });
    expect(getQueue()).toHaveLength(1);
  });

  it('clearQueue empties the queue', () => {
    enqueueWrite('p1', 'feed', [{ id: 1 }]);
    enqueueWrite('p1', 'diaper', [{ id: 2 }]);
    clearQueue();
    expect(getQueue()).toEqual([]);
  });

  it('enqueueWrite records queuedAt timestamp', () => {
    const before = Date.now();
    enqueueWrite('p1', 'sleep', [{ id: 100 }]);
    const after = Date.now();
    const item = getQueue()[0];
    expect(item.queuedAt).toBeGreaterThanOrEqual(before);
    expect(item.queuedAt).toBeLessThanOrEqual(after);
  });
});

// ── flushQueue ────────────────────────────────────────────────────────────────

describe('flushQueue', () => {
  beforeEach(() => {
    clearQueue();
    vi.clearAllMocks();
  });

  it('is a no-op when queue is empty', async () => {
    await flushQueue(mockDb);
    expect(mockSaveEntries).not.toHaveBeenCalled();
  });

  it('calls saveEntries for each queued write', async () => {
    enqueueWrite('p1', 'feed', [{ id: 1 }]);
    enqueueWrite('p1', 'diaper', [{ id: 2 }]);
    await flushQueue(mockDb);
    expect(mockSaveEntries).toHaveBeenCalledTimes(2);
  });

  it('clears the queue after flushing', async () => {
    enqueueWrite('p1', 'feed', [{ id: 1 }]);
    await flushQueue(mockDb);
    expect(getQueue()).toEqual([]);
  });

  it('passes correct arguments to saveEntries', async () => {
    const entries = [{ id: 42, date: '2025-01-01' }];
    enqueueWrite('profile_1', 'sleep', entries);
    await flushQueue(mockDb);
    expect(mockSaveEntries).toHaveBeenCalledWith(mockDb, 'profile_1', 'sleep', entries);
  });
});

// ── pullAndMerge ──────────────────────────────────────────────────────────────

describe('pullAndMerge', () => {
  beforeEach(() => {
    resetMockStore();
    vi.clearAllMocks();
    mockGetEntries.mockResolvedValue([]);
  });

  it('returns 0 and does nothing when db is null', async () => {
    const result = await pullAndMerge(null, 'p1');
    expect(result).toBe(0);
    expect(dg).not.toHaveBeenCalled();
  });

  it('returns 0 when all remote categories are empty', async () => {
    const result = await pullAndMerge(mockDb, 'p1');
    expect(result).toBe(0);
  });

  it('merges remote entries into empty local store', async () => {
    const remoteFeeds = [{ id: 100 }, { id: 200 }];
    mockGetEntries.mockImplementation(async (_db: unknown, _pid: unknown, cat: unknown) => {
      if (cat === 'feed') return remoteFeeds;
      return [];
    });

    const newCount = await pullAndMerge(mockDb, 'p1');
    expect(newCount).toBe(2);

    const saved = mockStore['profileData_p1'] as { logs: Record<string, unknown[]> };
    expect(saved.logs.feed).toHaveLength(2);
  });

  it('merges and deduplicates entries (local wins on collision)', async () => {
    const localEntry = { id: 100, type: 'local' };
    const remoteEntry = { id: 100, type: 'remote' };
    const remoteNewEntry = { id: 200, type: 'remote-new' };

    mockStore['profileData_p1'] = { logs: { feed: [localEntry] } };
    mockGetEntries.mockImplementation(async (_db: unknown, _pid: unknown, cat: unknown) => {
      if (cat === 'feed') return [remoteEntry, remoteNewEntry];
      return [];
    });

    const newCount = await pullAndMerge(mockDb, 'p1');
    // 1 new (id:200); id:100 is deduplicated, local wins
    expect(newCount).toBe(1);

    const saved = mockStore['profileData_p1'] as { logs: Record<string, { id: number; type: string }[]> };
    expect(saved.logs.feed).toHaveLength(2);
    const entry100 = saved.logs.feed.find((e) => e.id === 100);
    expect(entry100?.type).toBe('local');
  });

  it('preserves non-logs fields in the profile data', async () => {
    mockStore['profileData_p1'] = { logs: {}, birthDate: '2024-01-01', extra: 'preserved' };

    await pullAndMerge(mockDb, 'p1');

    const saved = mockStore['profileData_p1'] as Record<string, unknown>;
    expect(saved.birthDate).toBe('2024-01-01');
    expect(saved.extra).toBe('preserved');
  });

  it('calls getEntries for all 10 categories', async () => {
    await pullAndMerge(mockDb, 'p1');
    expect(mockGetEntries).toHaveBeenCalledTimes(10);
  });

  it('returns 0 (not negative) when remote has fewer entries than local', async () => {
    mockStore['profileData_p1'] = { logs: { feed: [{ id: 1 }, { id: 2 }, { id: 3 }] } };
    mockGetEntries.mockImplementation(async (_db: unknown, _pid: unknown, cat: unknown) => {
      if (cat === 'feed') return [{ id: 1 }]; // subset of local
      return [];
    });

    const newCount = await pullAndMerge(mockDb, 'p1');
    expect(newCount).toBe(0);
  });
});

// ── pushAll ───────────────────────────────────────────────────────────────────

describe('pushAll', () => {
  beforeEach(() => {
    resetMockStore();
    clearQueue();
    vi.clearAllMocks();
  });

  it('does nothing when there are no local entries', async () => {
    await pushAll(mockDb, 'p1', true);
    expect(mockSaveEntries).not.toHaveBeenCalled();
    expect(getQueue()).toEqual([]);
  });

  it('calls saveEntries for each non-empty category when online', async () => {
    mockStore['profileData_p1'] = {
      logs: {
        feed: [{ id: 1 }],
        diaper: [{ id: 2 }],
      },
    };

    await pushAll(mockDb, 'p1', true);
    expect(mockSaveEntries).toHaveBeenCalledTimes(2);
  });

  it('enqueues writes when offline (online=false)', async () => {
    mockStore['profileData_p1'] = { logs: { feed: [{ id: 1 }] } };

    await pushAll(mockDb, 'p1', false);
    expect(mockSaveEntries).not.toHaveBeenCalled();
    expect(getQueue()).toHaveLength(1);
    expect(getQueue()[0].category).toBe('feed');
  });

  it('enqueues writes when db is null (even if online=true)', async () => {
    mockStore['profileData_p1'] = { logs: { sleep: [{ id: 5 }] } };

    await pushAll(null, 'p1', true);
    expect(mockSaveEntries).not.toHaveBeenCalled();
    expect(getQueue()).toHaveLength(1);
  });

  it('passes correct profileId and category to saveEntries', async () => {
    const entries = [{ id: 99 }];
    mockStore['profileData_profile_2'] = { logs: { growth: entries } };

    await pushAll(mockDb, 'profile_2', true);
    expect(mockSaveEntries).toHaveBeenCalledWith(mockDb, 'profile_2', 'growth', entries);
  });

  it('skips categories with empty entry arrays', async () => {
    mockStore['profileData_p1'] = { logs: { feed: [], diaper: [{ id: 1 }] } };

    await pushAll(mockDb, 'p1', true);
    expect(mockSaveEntries).toHaveBeenCalledTimes(1);
    expect(mockSaveEntries).toHaveBeenCalledWith(mockDb, 'p1', 'diaper', [{ id: 1 }]);
  });
});
