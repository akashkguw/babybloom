/**
 * Unit tests for src/hooks/useFirebaseSync.ts
 *
 * Tests syncStatus transitions and hook behaviour using mocked dependencies.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Mock @/utils/firebaseConfig ───────────────────────────────────────────────
const mockGetFirestoreDb = vi.fn(() => null as unknown);

vi.mock('@/utils/firebaseConfig', () => ({
  getFirestoreDb: () => mockGetFirestoreDb(),
  initFirebaseWithBundledConfig: vi.fn(),
}));

// ── Mock @/utils/syncService ──────────────────────────────────────────────────
const mockPullAndMerge = vi.fn(async (_db: unknown, _fc: unknown, _pid: unknown) => 0);
const mockPushAll = vi.fn(async (_db: unknown, _fc: unknown, _pid: unknown, _online: unknown) => undefined);
const mockFlushQueue = vi.fn(async (_db: unknown) => undefined);
const mockLoadFamilyCode = vi.fn(async () => 'bloom-testcode' as string | null);
const mockSaveFamilyCode = vi.fn(async (_code: string) => undefined);
const mockGenerateUniqueFamilyCode = vi.fn(async (_db: unknown) => 'bloom-newcode1');

vi.mock('@/utils/syncService', () => ({
  pullAndMerge: (db: unknown, fc: unknown, pid: unknown) => mockPullAndMerge(db, fc, pid),
  pushAll: (db: unknown, fc: unknown, pid: unknown, online: unknown) => mockPushAll(db, fc, pid, online),
  flushQueue: (db: unknown) => mockFlushQueue(db),
  loadFamilyCode: () => mockLoadFamilyCode(),
  saveFamilyCode: (code: string) => mockSaveFamilyCode(code),
  generateUniqueFamilyCode: (db: unknown) => mockGenerateUniqueFamilyCode(db),
  generateFamilyCode: vi.fn(() => 'bloom-testrand'),
  SYNC_CATEGORIES: ['feed', 'diaper'],
  mergeEntries: vi.fn(),
  enqueueWrite: vi.fn(),
  getQueue: vi.fn(() => []),
  clearQueue: vi.fn(),
}));

import { useFirebaseSync } from '@/hooks/useFirebaseSync';

const mockDb = { _isMock: true };

// ── helpers ───────────────────────────────────────────────────────────────────

function resetMocks() {
  vi.clearAllMocks();
  mockGetFirestoreDb.mockReturnValue(null);
  mockPullAndMerge.mockResolvedValue(0);
  mockPushAll.mockResolvedValue(undefined);
  mockFlushQueue.mockResolvedValue(undefined);
  mockLoadFamilyCode.mockResolvedValue('bloom-testcode');
  mockSaveFamilyCode.mockResolvedValue(undefined);
  mockGenerateUniqueFamilyCode.mockResolvedValue('bloom-newcode1');
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useFirebaseSync', () => {
  beforeEach(() => {
    resetMocks();
    // Default: online
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts with syncStatus "idle"', () => {
      const { result } = renderHook(() => useFirebaseSync(null));
      expect(result.current.syncStatus).toBe('idle');
    });

    it('starts with lastSyncedAt null', () => {
      const { result } = renderHook(() => useFirebaseSync(null));
      expect(result.current.lastSyncedAt).toBeNull();
    });

    it('exposes syncAll function', () => {
      const { result } = renderHook(() => useFirebaseSync(null));
      expect(typeof result.current.syncAll).toBe('function');
    });

    it('exposes familyCode, setFamilyCode, and generateAndSaveFamilyCode', () => {
      const { result } = renderHook(() => useFirebaseSync(null));
      expect(typeof result.current.setFamilyCode).toBe('function');
      expect(typeof result.current.generateAndSaveFamilyCode).toBe('function');
    });
  });

  describe('no-op when unconfigured', () => {
    it('does not call pullAndMerge when db is null', async () => {
      mockGetFirestoreDb.mockReturnValue(null);
      renderHook(() => useFirebaseSync('p1'));
      await waitFor(() => {});
      expect(mockPullAndMerge).not.toHaveBeenCalled();
    });

    it('does not call pullAndMerge when profileId is null', async () => {
      mockGetFirestoreDb.mockReturnValue(mockDb);
      renderHook(() => useFirebaseSync(null));
      await waitFor(() => {});
      expect(mockPullAndMerge).not.toHaveBeenCalled();
    });

    it('does not call pullAndMerge when familyCode is null', async () => {
      mockGetFirestoreDb.mockReturnValue(mockDb);
      mockLoadFamilyCode.mockResolvedValue(null);
      renderHook(() => useFirebaseSync('p1'));
      await waitFor(() => {});
      expect(mockPullAndMerge).not.toHaveBeenCalled();
    });

    it('status stays idle when unconfigured', async () => {
      mockGetFirestoreDb.mockReturnValue(null);
      const { result } = renderHook(() => useFirebaseSync('p1'));
      await waitFor(() => {});
      expect(result.current.syncStatus).toBe('idle');
    });
  });

  describe('successful sync (online)', () => {
    it('transitions idle -> syncing -> synced on successful sync', async () => {
      mockGetFirestoreDb.mockReturnValue(mockDb);
      const { result } = renderHook(() => useFirebaseSync('p1'));

      await waitFor(() => {
        expect(result.current.syncStatus).toBe('synced');
      });
    });

    it('sets lastSyncedAt after successful sync', async () => {
      mockGetFirestoreDb.mockReturnValue(mockDb);
      const before = Date.now();
      const { result } = renderHook(() => useFirebaseSync('p1'));

      await waitFor(() => {
        expect(result.current.syncStatus).toBe('synced');
      });

      expect(result.current.lastSyncedAt).not.toBeNull();
      expect(result.current.lastSyncedAt!).toBeGreaterThanOrEqual(before);
    });

    it('calls flushQueue, pullAndMerge, and pushAll with familyCode when online', async () => {
      mockGetFirestoreDb.mockReturnValue(mockDb);
      renderHook(() => useFirebaseSync('p1'));

      await waitFor(() => {
        expect(mockFlushQueue).toHaveBeenCalledWith(mockDb);
      });
      expect(mockPullAndMerge).toHaveBeenCalledWith(mockDb, 'bloom-testcode', 'p1');
      expect(mockPushAll).toHaveBeenCalledWith(mockDb, 'bloom-testcode', 'p1', true);
    });
  });

  describe('offline behaviour', () => {
    it('skips pull and only queues writes when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      mockGetFirestoreDb.mockReturnValue(mockDb);

      renderHook(() => useFirebaseSync('p1'));

      await waitFor(() => {
        expect(mockPushAll).toHaveBeenCalledWith(mockDb, 'bloom-testcode', 'p1', false);
      });
      expect(mockPullAndMerge).not.toHaveBeenCalled();
      expect(mockFlushQueue).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('transitions to "error" when pullAndMerge throws', async () => {
      mockGetFirestoreDb.mockReturnValue(mockDb);
      mockPullAndMerge.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useFirebaseSync('p1'));

      await waitFor(() => {
        expect(result.current.syncStatus).toBe('error');
      });
    });

    it('transitions to "error" when flushQueue throws', async () => {
      mockGetFirestoreDb.mockReturnValue(mockDb);
      mockFlushQueue.mockRejectedValue(new Error('Flush error'));

      const { result } = renderHook(() => useFirebaseSync('p1'));

      await waitFor(() => {
        expect(result.current.syncStatus).toBe('error');
      });
    });

    it('does not update lastSyncedAt on error', async () => {
      mockGetFirestoreDb.mockReturnValue(mockDb);
      mockPullAndMerge.mockRejectedValue(new Error('err'));

      const { result } = renderHook(() => useFirebaseSync('p1'));

      await waitFor(() => {
        expect(result.current.syncStatus).toBe('error');
      });
      expect(result.current.lastSyncedAt).toBeNull();
    });
  });

  describe('manual syncAll()', () => {
    it('can be called manually to trigger a sync cycle', async () => {
      mockGetFirestoreDb.mockReturnValue(mockDb);
      const { result } = renderHook(() => useFirebaseSync('p1'));

      // Wait for initial sync to complete
      await waitFor(() => expect(result.current.syncStatus).toBe('synced'));

      vi.clearAllMocks();
      mockGetFirestoreDb.mockReturnValue(mockDb);
      mockLoadFamilyCode.mockResolvedValue('bloom-testcode');
      mockPullAndMerge.mockResolvedValue(0);
      mockPushAll.mockResolvedValue(undefined);
      mockFlushQueue.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.syncAll();
      });

      expect(mockPullAndMerge).toHaveBeenCalledTimes(1);
      expect(result.current.syncStatus).toBe('synced');
    });

    it('is a no-op when profileId is null', async () => {
      mockGetFirestoreDb.mockReturnValue(mockDb);
      const { result } = renderHook(() => useFirebaseSync(null));

      await act(async () => {
        await result.current.syncAll();
      });

      expect(mockPullAndMerge).not.toHaveBeenCalled();
    });
  });

  describe('family code management', () => {
    it('loads familyCode from IndexedDB on mount', async () => {
      const { result } = renderHook(() => useFirebaseSync(null));

      await waitFor(() => {
        expect(result.current.familyCode).toBe('bloom-testcode');
      });
      expect(mockLoadFamilyCode).toHaveBeenCalled();
    });

    it('familyCode is null when loadFamilyCode returns null', async () => {
      mockLoadFamilyCode.mockResolvedValue(null);
      const { result } = renderHook(() => useFirebaseSync(null));

      await waitFor(() => {
        expect(mockLoadFamilyCode).toHaveBeenCalled();
      });
      expect(result.current.familyCode).toBeNull();
    });

    it('setFamilyCode saves to IndexedDB and updates state', async () => {
      const { result } = renderHook(() => useFirebaseSync(null));

      await act(async () => {
        await result.current.setFamilyCode('bloom-newone1');
      });

      expect(mockSaveFamilyCode).toHaveBeenCalledWith('bloom-newone1');
      expect(result.current.familyCode).toBe('bloom-newone1');
    });

    it('generateAndSaveFamilyCode generates unique code and saves it', async () => {
      mockGetFirestoreDb.mockReturnValue(mockDb);
      const { result } = renderHook(() => useFirebaseSync(null));

      let code: string = '';
      await act(async () => {
        code = await result.current.generateAndSaveFamilyCode();
      });

      expect(code).toBe('bloom-newcode1');
      expect(mockGenerateUniqueFamilyCode).toHaveBeenCalled();
      expect(mockSaveFamilyCode).toHaveBeenCalledWith('bloom-newcode1');
      expect(result.current.familyCode).toBe('bloom-newcode1');
    });
  });

  describe('online event listener', () => {
    it('triggers syncAll when window "online" event fires', async () => {
      mockGetFirestoreDb.mockReturnValue(mockDb);
      const { result } = renderHook(() => useFirebaseSync('p1'));

      // Wait for initial sync
      await waitFor(() => expect(result.current.syncStatus).toBe('synced'));

      vi.clearAllMocks();
      mockGetFirestoreDb.mockReturnValue(mockDb);
      mockLoadFamilyCode.mockResolvedValue('bloom-testcode');
      mockPullAndMerge.mockResolvedValue(0);
      mockPushAll.mockResolvedValue(undefined);
      mockFlushQueue.mockResolvedValue(undefined);

      await act(async () => {
        window.dispatchEvent(new Event('online'));
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(mockPullAndMerge).toHaveBeenCalled();
    });
  });
});
