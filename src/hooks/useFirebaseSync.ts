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
import { getFirestoreDb, initFirebaseWithBundledConfig } from '@/utils/firebaseConfig';
import {
  pullAndMerge,
  pushAll,
  flushQueue,
  loadFamilyCode,
  saveFamilyCode,
  generateUniqueFamilyCode,
} from '@/utils/syncService';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface UseFirebaseSyncReturn {
  syncAll: () => Promise<void>;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  familyCode: string | null;
  setFamilyCode: (code: string) => Promise<void>;
  generateAndSaveFamilyCode: () => Promise<string>;
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
  const [familyCode, setFamilyCodeState] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const familyCodeRef = useRef<string | null>(null);

  // Load family code from IndexedDB on mount
  useEffect(() => {
    loadFamilyCode().then((code) => {
      if (isMountedRef.current) {
        setFamilyCodeState(code);
        familyCodeRef.current = code;
      }
    });
  }, []);

  /** Persist a family code to IndexedDB and update local state. */
  const setFamilyCode = useCallback(async (code: string): Promise<void> => {
    await saveFamilyCode(code);
    familyCodeRef.current = code;
    if (isMountedRef.current) setFamilyCodeState(code);
  }, []);

  /** Generate a unique family code (checked against Firestore), save it, and return it. */
  const generateAndSaveFamilyCode = useCallback(async (): Promise<string> => {
    initFirebaseWithBundledConfig();
    const db = getFirestoreDb();
    const code = await generateUniqueFamilyCode(db);
    await setFamilyCode(code);
    return code;
  }, [setFamilyCode]);

  const syncAll = useCallback(async (): Promise<void> => {
    // Auto-initialize from bundled env-var credentials if not yet done
    initFirebaseWithBundledConfig();
    const db = getFirestoreDb();
    const code = familyCodeRef.current;
    if (!db || !profileId || !code) return;
    if (!isMountedRef.current) return;

    setSyncStatus('syncing');

    try {
      if (navigator.onLine) {
        // Online: flush any queued writes, then pull+merge, then push local
        await flushQueue(db);
        await pullAndMerge(db, code, profileId);
        await pushAll(db, code, profileId, true);
      } else {
        // Offline: queue local writes for later; skip remote pull
        await pushAll(db, code, profileId, false);
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
    // Wait for familyCode to load before first sync
    loadFamilyCode().then((code) => {
      familyCodeRef.current = code;
      if (isMountedRef.current) {
        setFamilyCodeState(code);
        if (code) syncAll();
      }
    });
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

  return { syncAll, syncStatus, lastSyncedAt, familyCode, setFamilyCode, generateAndSaveFamilyCode };
}
