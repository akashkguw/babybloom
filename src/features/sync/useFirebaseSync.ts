/**
 * useFirebaseSync — React hook for Firebase Realtime Database autosync.
 *
 * Behaviour:
 * - Reads firebaseConfig + firebaseSyncKey from IndexedDB on mount.
 * - If configured, sets up a real-time listener on the sync path.
 * - When remote data arrives, merges it with local logs (no duplicates).
 * - When local logs change, pushes them to Firebase after a 2-second debounce.
 * - All Firebase imports are dynamic (lazy) so unconfigured users pay no bundle cost.
 *
 * Manual setup instructions for the user:
 * 1. Go to https://console.firebase.google.com/ and create a project.
 * 2. Enable "Realtime Database" (not Firestore) in the Build section.
 * 3. Set database rules to allow read/write (for personal use):
 *    { "rules": { ".read": true, ".write": true } }
 * 4. In Project Settings → Your apps → Web app, register an app and copy
 *    the firebaseConfig object.
 * 5. In BabyBloom → Partner Sync → Auto Sync tab, paste the config and set a
 *    sync key (any unique string, e.g. "mybaby2024"). Share the same key on
 *    all devices to keep them in sync.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { dg, ds } from '@/lib/db';
import { mergeRemoteLogs, syncPath as makeSyncPath, isValidFirebaseConfig, isValidSyncKey } from './firebaseSyncUtils';
import type { FirebaseConfig, Logs } from './firebaseSyncUtils';

export type SyncStatus = 'unconfigured' | 'connecting' | 'synced' | 'syncing' | 'error';

export interface FirebaseSyncState {
  status: SyncStatus;
  lastSynced: number | null;
  error: string | null;
  syncKey: string | null;
  configured: boolean;
  saveConfig: (config: FirebaseConfig, key: string) => Promise<void>;
  removeConfig: () => Promise<void>;
}

interface UseFirebaseSyncOptions {
  logs: Logs;
  setLogs: (logs: Logs) => void;
  profileId: number | null;
}

export function useFirebaseSync({ logs, setLogs, profileId }: UseFirebaseSyncOptions): FirebaseSyncState {
  const [status, setStatus] = useState<SyncStatus>('unconfigured');
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncKey, setSyncKey] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);

  // Keep a mutable ref so the listener closure always sees current logs
  const logsRef = useRef<Logs>(logs);
  logsRef.current = logs;

  // Stored as plain closures so we avoid importing Firebase types statically
  const detachListenerRef = useRef<(() => void) | null>(null);
  const pushLogsRef = useRef<((logs: Logs) => Promise<void>) | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (detachListenerRef.current) {
      try { detachListenerRef.current(); } catch { /* ignore */ }
      detachListenerRef.current = null;
    }
    pushLogsRef.current = null;
  }, []);

  const initSync = useCallback(async (config: FirebaseConfig, key: string) => {
    cleanup();
    setStatus('connecting');
    setError(null);

    try {
      // Dynamic imports keep firebase out of the main bundle for unconfigured users
      const { initializeApp, getApps } = await import('firebase/app');
      const { getDatabase, ref, set, onValue, off } = await import('firebase/database');

      // Reuse existing Firebase app instance if already initialized
      const existingApp = getApps().find((a) => a.name === 'babybloom');
      const app = existingApp ?? initializeApp(config, 'babybloom');

      const db = getDatabase(app);
      const path = makeSyncPath(key, profileId);
      const dbRef = ref(db, path);

      onValue(
        dbRef,
        (snapshot) => {
          const remoteData = snapshot.val() as Logs | null;
          if (remoteData && typeof remoteData === 'object') {
            const { merged, newCount } = mergeRemoteLogs(logsRef.current, remoteData);
            if (newCount > 0) {
              setLogs(merged);
            }
          }
          setLastSynced(Date.now());
          setStatus('synced');
        },
        (err) => {
          setError(err.message);
          setStatus('error');
        }
      );

      // Store cleanup/push as typed closures to avoid importing Firebase types statically
      detachListenerRef.current = () => off(dbRef);
      pushLogsRef.current = (logsToSync: Logs) => set(dbRef, logsToSync);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Firebase initialisation failed';
      setError(msg);
      setStatus('error');
    }
  }, [profileId, setLogs, cleanup]);

  // Load config on mount (and re-run if profileId changes)
  useEffect(() => {
    Promise.all([dg('firebaseConfig'), dg('firebaseSyncKey')]).then(([config, key]) => {
      if (isValidFirebaseConfig(config) && isValidSyncKey(key)) {
        setSyncKey(key as string);
        setConfigured(true);
        initSync(config as FirebaseConfig, key as string);
      }
    });

    return cleanup;
  }, [initSync, cleanup, profileId]);

  // Push logs to Firebase after 2-second debounce whenever logs change
  useEffect(() => {
    if (!configured || !pushLogsRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (!pushLogsRef.current) return;
      try {
        setStatus('syncing');
        await pushLogsRef.current(logs);
        setLastSynced(Date.now());
        setStatus('synced');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sync push failed';
        setError(msg);
        setStatus('error');
      }
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [logs, configured]);

  const saveConfig = useCallback(async (config: FirebaseConfig, key: string) => {
    await ds('firebaseConfig', config);
    await ds('firebaseSyncKey', key);
    setSyncKey(key);
    setConfigured(true);
    await initSync(config, key);
  }, [initSync]);

  const removeConfig = useCallback(async () => {
    await ds('firebaseConfig', null);
    await ds('firebaseSyncKey', null);
    cleanup();
    setSyncKey(null);
    setConfigured(false);
    setStatus('unconfigured');
    setError(null);
    setLastSynced(null);
  }, [cleanup]);

  return { status, lastSynced, error, syncKey, configured, saveConfig, removeConfig };
}
