/**
 * useFirebaseSync — React hook for Firestore-based bidirectional autosync.
 *
 * Exposes:
 * - syncAll()      — manually trigger a full pull+push cycle
 * - syncStatus     — 'idle' | 'syncing' | 'synced' | 'error'
 * - lastSyncedAt   — timestamp of last successful sync (or null)
 *
 * Behaviour:
 * - On mount, triggers an initial sync if Firestore is configured.
 * - Listens to online/offline events; when coming back online, flushes the
 *   offline write queue and runs a full sync.
 * - All operations are graceful no-ops when Firebase is not yet configured.
 *
 * Dependencies (implemented in #157):
 * - @/utils/firebaseConfig  — getFirestoreDb()
 * - @/utils/syncService     — pullAndMerge(), pushAll(), flushQueue()
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getFirestoreDb } from '@/utils/firebaseConfig';
import { pullAndMerge, pushAll, flushQueue } from '@/utils/syncService';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface UseFirebaseSyncReturn {
  syncAll: () => Promise<void>;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
}

/**
 * Hook for bidirectional Firestore sync for a given profile.
 *
 * @param profileId — the profile whose data should be synced.
 *   Pass null to disable sync (e.g., before a profile is loaded).
 */
export function useFirebaseSync(profileId: string | null): UseFirebaseSyncReturn {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const isMountedRef = useRef(true);

  const syncAll = useCallback(async (): Promise<void> => {
    const db = getFirestoreDb();
    if (!db || !profileId) return;
    if (!isMountedRef.current) return;

    setSyncStatus('syncing');

    try {
      if (navigator.onLine) {
        // Online: flush any queued writes, then pull+merge, then push local
        await flushQueue(db);
        await pullAndMerge(db, profileId);
        await pushAll(db, profileId, true);
      } else {
        // Offline: queue local writes for later; skip remote pull
        await pushAll(db, profileId, false);
      }

      if (isMountedRef.current) {
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());
      }
    } catch {
      if (isMountedRef.current) {
        setSyncStatus('error');
      }
    }
  }, [profileId]);

  // Initial sync on mount; cleanup marks component as unmounted
  useEffect(() => {
    isMountedRef.current = true;
    syncAll();
    return () => {
      isMountedRef.current = false;
    };
  }, [syncAll]);

  // Re-sync when connectivity is restored
  useEffect(() => {
    const handleOnline = () => { syncAll(); };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncAll]);

  return { syncAll, syncStatus, lastSyncedAt };
}
