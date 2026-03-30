/**
 * Firestore CRUD helpers — typed read/write utilities for each data category.
 *
 * Data model mirrors the IndexedDB schema (see lib/db/schema.ts).
 * Firestore collection path: profiles/{profileId}/{category}/{entryId}
 *
 * All helpers accept db: Firestore | null and are graceful no-ops when null,
 * so the app can import these utilities before Firebase is configured without crashing.
 *
 * This is a pure utility layer — it does NOT modify any app state or IndexedDB.
 * Wire-up into components is handled by the sync service (pt 2) and UI (pt 3).
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import type { Firestore, DocumentData } from 'firebase/firestore';
import type {
  FeedEntry,
  DiaperEntry,
  SleepEntry,
  GrowthEntry,
  TempEntry,
  BathEntry,
  MassageEntry,
  MedsEntry,
  AllergyEntry,
} from '@/lib/db/schema';
import { encrypt, decrypt, isEncryptedPayload, type EncryptedPayload } from '@/utils/crypto';

// Union of all log entry types
export type AnyLogEntry =
  | FeedEntry
  | DiaperEntry
  | SleepEntry
  | GrowthEntry
  | TempEntry
  | BathEntry
  | MassageEntry
  | MedsEntry
  | AllergyEntry;

// ── Serialization helpers (pure — no Firebase SDK dependency) ─────────────────

/**
 * Convert an IndexedDB entry to a plain Firestore document object.
 * Strips undefined fields so Firestore doesn't reject them.
 */
export function toFirestoreDoc(entry: AnyLogEntry): DocumentData {
  return Object.fromEntries(
    Object.entries(entry).filter(([, v]) => v !== undefined)
  ) as DocumentData;
}

/**
 * Restore a typed entry from a Firestore document snapshot data.
 * Performs a simple cast — Firestore documents mirror the IndexedDB schema exactly.
 */
export function fromFirestoreDoc<T extends AnyLogEntry>(data: DocumentData): T {
  return data as T;
}

// ── Collection path helper ────────────────────────────────────────────────────

/**
 * Build the Firestore collection path for a category.
 * Path: families/{familyCode}/profiles/{profileId}/{category}
 *
 * The familyCode isolates each family's data. Users share the same code
 * across devices to sync. Without it, different users' data would collide.
 */
function categoryCol(db: Firestore, familyCode: string, profileId: string, category: string) {
  return collection(db, 'families', familyCode, 'profiles', profileId, category);
}

// ── Encrypted CRUD helpers ───────────────────────────────────────────────────
// These store each category as a single encrypted document at:
//   families/{familyCode}/profiles/{profileId}/{category}/_encrypted
// The document contains { ct, iv, ts } where ts is the write timestamp.

/**
 * Save entries for a category as a single encrypted document.
 * Includes a timestamp for TTL-based cleanup.
 */
export async function saveEntriesEncrypted<T extends AnyLogEntry>(
  db: Firestore | null,
  familyCode: string,
  profileId: string,
  category: string,
  entries: T[],
): Promise<void> {
  if (!db || !familyCode || entries.length === 0) return;
  const payload = await encrypt(entries, familyCode);
  const col = categoryCol(db, familyCode, profileId, category);
  await setDoc(doc(col, '_encrypted'), {
    ct: payload.ct,
    iv: payload.iv,
    ts: Date.now(),
  });
}

/**
 * Fetch and decrypt entries for a category from Firestore.
 * Returns an empty array if the document doesn't exist or decryption fails.
 */
export async function getEntriesEncrypted<T extends AnyLogEntry>(
  db: Firestore | null,
  familyCode: string,
  profileId: string,
  category: string,
): Promise<T[]> {
  if (!db || !familyCode) return [];
  const col = categoryCol(db, familyCode, profileId, category);
  const snap = await getDoc(doc(col, '_encrypted'));
  if (!snap.exists()) return [];
  const data = snap.data();
  if (!isEncryptedPayload(data)) return [];
  try {
    return await decrypt<T[]>(data as EncryptedPayload, familyCode);
  } catch {
    // Decryption failed — stale data from a different family code, skip
    return [];
  }
}

/**
 * Delete the encrypted document for a category (post-pull cleanup).
 */
export async function deleteEncryptedCategory(
  db: Firestore | null,
  familyCode: string,
  profileId: string,
  category: string,
): Promise<void> {
  if (!db || !familyCode) return;
  const col = categoryCol(db, familyCode, profileId, category);
  await deleteDoc(doc(col, '_encrypted'));
}

