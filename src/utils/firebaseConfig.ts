/**
 * Firebase Firestore configuration and initialization.
 *
 * This module manages the Firestore db instance lifecycle.
 * Firebase is a service provided by the app — credentials are bundled via
 * VITE_ environment variables (VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID,
 * VITE_FIREBASE_APP_ID). If env vars are not set, sync is gracefully disabled.
 *
 * Call initFirebaseWithBundledConfig() on app mount to activate sync automatically.
 * All firestoreUtils helpers accept db: Firestore | null and are no-ops when null.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

/** Minimum required fields to initialize a Firebase project for Firestore. */
export interface FirestoreProjectConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const APP_NAME = 'babybloom-firestore';

let _db: Firestore | null = null;

/**
 * Validate that a value has the minimum required fields for Firestore.
 * Requires apiKey, projectId, and appId.
 */
export function isValidFirestoreConfig(config: unknown): config is FirestoreProjectConfig {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;
  return (
    typeof c.apiKey === 'string' && c.apiKey.length > 0 &&
    typeof c.projectId === 'string' && c.projectId.length > 0 &&
    typeof c.appId === 'string' && c.appId.length > 0
  );
}

/**
 * Initialize Firebase with the given config and return the Firestore db instance.
 * Safe to call multiple times — reuses the existing app and db if already initialized.
 * Throws if the config is invalid.
 */
export function initFirebaseConfig(config: FirestoreProjectConfig): Firestore {
  if (_db) return _db;
  if (!isValidFirestoreConfig(config)) {
    throw new Error('Invalid Firebase config: apiKey, projectId, and appId are required.');
  }
  const existing = getApps().find((a) => a.name === APP_NAME);
  const app = existing ?? initializeApp(config, APP_NAME);
  _db = getFirestore(app);
  return _db;
}

/**
 * Get the current Firestore db instance.
 * Returns null if initFirebaseConfig() has not been called yet.
 * All firestoreUtils helpers treat null as "not configured" and are no-ops.
 */
export function getFirestoreDb(): Firestore | null {
  return _db;
}

/**
 * Reset the Firestore instance. Used when reconfiguring or in tests.
 * After calling this, getFirestoreDb() returns null until initFirebaseConfig() is called again.
 */
export function resetFirebaseConfig(): void {
  _db = null;
}

/**
 * Read Firebase credentials from VITE_ environment variables.
 * Returns null if any required variable (apiKey, projectId, appId) is missing.
 * Users never supply credentials — the app owner bundles them at build time.
 */
export function getBundledConfig(): FirestoreProjectConfig | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env ?? {};
  const apiKey = env.VITE_FIREBASE_API_KEY as string | undefined;
  const projectId = env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const appId = env.VITE_FIREBASE_APP_ID as string | undefined;
  if (!apiKey || !projectId || !appId) return null;
  return { apiKey, projectId, appId };
}

/**
 * Initialize Firebase using bundled VITE_ env vars.
 * Returns the Firestore db instance on success, or null if env vars are absent.
 * Safe to call multiple times — reuses the existing instance.
 * Never throws; if initialization fails the sync is silently disabled.
 */
export function initFirebaseWithBundledConfig(): Firestore | null {
  if (_db) return _db;
  const config = getBundledConfig();
  if (!config) return null;
  try {
    return initFirebaseConfig(config);
  } catch {
    return null;
  }
}
