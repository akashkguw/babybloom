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
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
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

// ── Generic CRUD helpers ──────────────────────────────────────────────────────

/**
 * Save a single log entry to Firestore.
 * No-op if db is null (not yet configured).
 */
export async function saveEntry<T extends AnyLogEntry>(
  db: Firestore | null,
  familyCode: string,
  profileId: string,
  category: string,
  entry: T,
): Promise<void> {
  if (!db || !familyCode) return;
  const col = categoryCol(db, familyCode, profileId, category);
  await setDoc(doc(col, String(entry.id)), toFirestoreDoc(entry));
}

/**
 * Batch-save all entries in a category to Firestore.
 * Uses a write batch for efficiency (max 500 entries per batch — sufficient for baby logs).
 * No-op if db is null.
 */
export async function saveEntries<T extends AnyLogEntry>(
  db: Firestore | null,
  familyCode: string,
  profileId: string,
  category: string,
  entries: T[],
): Promise<void> {
  if (!db || !familyCode || entries.length === 0) return;
  const batch = writeBatch(db);
  const col = categoryCol(db, familyCode, profileId, category);
  for (const entry of entries) {
    batch.set(doc(col, String(entry.id)), toFirestoreDoc(entry));
  }
  await batch.commit();
}

/**
 * Fetch all entries in a category from Firestore.
 * Returns an empty array if db is null or the collection is empty.
 */
export async function getEntries<T extends AnyLogEntry>(
  db: Firestore | null,
  familyCode: string,
  profileId: string,
  category: string,
): Promise<T[]> {
  if (!db || !familyCode) return [];
  const col = categoryCol(db, familyCode, profileId, category);
  const snapshot = await getDocs(col);
  return snapshot.docs.map((d) => fromFirestoreDoc<T>(d.data()));
}

/**
 * Delete a single log entry from Firestore by its id.
 * No-op if db is null.
 */
export async function deleteEntry(
  db: Firestore | null,
  familyCode: string,
  profileId: string,
  category: string,
  id: number,
): Promise<void> {
  if (!db || !familyCode) return;
  const col = categoryCol(db, familyCode, profileId, category);
  await deleteDoc(doc(col, String(id)));
}

// ── Category-specific typed helpers ──────────────────────────────────────────
// Thin wrappers over the generic helpers — provide typed entry parameters.
// All accept familyCode (fc) as first data param after db.

export const saveFeedEntries = (db: Firestore | null, fc: string, pid: string, entries: FeedEntry[]) =>
  saveEntries(db, fc, pid, 'feed', entries);

export const getFeedEntries = (db: Firestore | null, fc: string, pid: string) =>
  getEntries<FeedEntry>(db, fc, pid, 'feed');

export const savePumpEntries = (db: Firestore | null, fc: string, pid: string, entries: FeedEntry[]) =>
  saveEntries(db, fc, pid, 'pump', entries);

export const getPumpEntries = (db: Firestore | null, fc: string, pid: string) =>
  getEntries<FeedEntry>(db, fc, pid, 'pump');

export const saveDiaperEntries = (db: Firestore | null, fc: string, pid: string, entries: DiaperEntry[]) =>
  saveEntries(db, fc, pid, 'diaper', entries);

export const getDiaperEntries = (db: Firestore | null, fc: string, pid: string) =>
  getEntries<DiaperEntry>(db, fc, pid, 'diaper');

export const saveSleepEntries = (db: Firestore | null, fc: string, pid: string, entries: SleepEntry[]) =>
  saveEntries(db, fc, pid, 'sleep', entries);

export const getSleepEntries = (db: Firestore | null, fc: string, pid: string) =>
  getEntries<SleepEntry>(db, fc, pid, 'sleep');

export const saveGrowthEntries = (db: Firestore | null, fc: string, pid: string, entries: GrowthEntry[]) =>
  saveEntries(db, fc, pid, 'growth', entries);

export const getGrowthEntries = (db: Firestore | null, fc: string, pid: string) =>
  getEntries<GrowthEntry>(db, fc, pid, 'growth');

export const saveTempEntries = (db: Firestore | null, fc: string, pid: string, entries: TempEntry[]) =>
  saveEntries(db, fc, pid, 'temp', entries);

export const getTempEntries = (db: Firestore | null, fc: string, pid: string) =>
  getEntries<TempEntry>(db, fc, pid, 'temp');

export const saveBathEntries = (db: Firestore | null, fc: string, pid: string, entries: BathEntry[]) =>
  saveEntries(db, fc, pid, 'bath', entries);

export const getBathEntries = (db: Firestore | null, fc: string, pid: string) =>
  getEntries<BathEntry>(db, fc, pid, 'bath');

export const saveMedsEntries = (db: Firestore | null, fc: string, pid: string, entries: MedsEntry[]) =>
  saveEntries(db, fc, pid, 'meds', entries);

export const getMedsEntries = (db: Firestore | null, fc: string, pid: string) =>
  getEntries<MedsEntry>(db, fc, pid, 'meds');

export const saveAllergyEntries = (db: Firestore | null, fc: string, pid: string, entries: AllergyEntry[]) =>
  saveEntries(db, fc, pid, 'allergy', entries);

export const getAllergyEntries = (db: Firestore | null, fc: string, pid: string) =>
  getEntries<AllergyEntry>(db, fc, pid, 'allergy');
