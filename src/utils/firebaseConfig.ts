/**
 * Firebase Firestore configuration and initialization.
 *
 * This module manages the Firestore db instance lifecycle.
 * Call initFirebaseConfig(config) once (e.g. from a settings UI) to activate sync.
 * All firestoreUtils helpers accept db: Firestore | null and are no-ops when null.
 *
 * Manual setup steps (for users):
 * 1. Go to https://console.firebase.google.com/ and create a project.
 * 2. Build → Firestore Database → Create database (start in test mode).
 * 3. Project Settings → Your apps → Add web app → copy the firebaseConfig object.
 * 4. In BabyBloom Settings, paste the config to enable cross-device sync.
 *
 * NOTE: Do NOT commit real Firebase credentials to source control.
 *       Users provide their own project credentials at runtime.
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
