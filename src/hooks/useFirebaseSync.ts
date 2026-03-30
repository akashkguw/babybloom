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
  /** Debounced sync trigger — call after any local data change. */
  requestSync: () => void;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  familyCode: string | null;
  syncError: string | null;
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
  const [syncError, setSyncError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const familyCodeRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Firebase not configured — stay idle (no env vars set)
    if (!db || !profileId) return;
    if (!isMountedRef.current) return;

    // No family code yet — user must explicitly generate or join one via PartnerSync UI
    const code = familyCodeRef.current;
    if (!code) return;

    setSyncStatus('syncing');
    setSyncError(null);

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
        setSyncError(null);
        setLastSyncedAt(Date.now());
      }
    } catch (err) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Sync failed';
        setSyncError(msg);
        setSyncStatus('error');
      }
    }
  }, [profileId]);

  // Initial sync on mount; cleanup marks component as unmounted
  useEffect(() => {
    isMountedRef.current = true;
    // Load family code, then always attempt sync (syncAll auto-generates code if needed)
    loadFamilyCode().then((code) => {
      familyCodeRef.current = code;
      if (isMountedRef.current) {
        setFamilyCodeState(code);
        syncAll();
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

  // Poll for new data from partner every 30 seconds while app is open
  useEffect(() => {
    const interval = setInterval(() => {
      if (isMountedRef.current && familyCodeRef.current && navigator.onLine) {
        syncAll();
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [syncAll]);

  /**
   * Debounced sync trigger — coalesces rapid data changes into a single
   * sync cycle after 3 seconds of inactivity. Safe to call on every save.
   */
  const requestSync = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      syncAll();
    }, 3000);
  }, [syncAll]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return { syncAll, requestSync, syncStatus, lastSyncedAt, familyCode, syncError, setFamilyCode, generateAndSaveFamilyCode };
}
