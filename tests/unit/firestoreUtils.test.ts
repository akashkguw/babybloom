/**
 * Unit tests for src/utils/firebaseConfig.ts and src/utils/firestoreUtils.ts
 *
 * Firebase SDK is fully mocked — no network calls are made.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock firebase/app ─────────────────────────────────────────────────────────
const mockApp = { name: 'babybloom-firestore' };
const mockApps: typeof mockApp[] = [];

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => {
    mockApps.push(mockApp);
    return mockApp;
  }),
  getApps: vi.fn(() => [...mockApps]),
}));

// ── Mock firebase/firestore ───────────────────────────────────────────────────
const mockDb = { type: 'firestore', _isMock: true };
const mockCol = { path: 'mock-collection' };
const mockDocRef = { id: 'mock-doc' };

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => mockDb),
  collection: vi.fn(() => mockCol),
  doc: vi.fn(() => mockDocRef),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
}));

import {
  isValidFirestoreConfig,
  initFirebaseConfig,
  getFirestoreDb,
  resetFirebaseConfig,
} from '@/utils/firebaseConfig';

import {
  toFirestoreDoc,
  fromFirestoreDoc,
  saveEntriesEncrypted,
  getEntriesEncrypted,
  deleteEncryptedCategory,
} from '@/utils/firestoreUtils';

import * as firestoreUtils from '@/utils/firestoreUtils';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';

// ── isValidFirestoreConfig ────────────────────────────────────────────────────

describe('isValidFirestoreConfig', () => {
  it('returns true for valid config with required fields', () => {
    expect(isValidFirestoreConfig({
      apiKey: 'AIzaSy_test',
      projectId: 'my-project',
      appId: '1:123:web:abc',
    })).toBe(true);
  });

  it('returns true with optional fields included', () => {
    expect(isValidFirestoreConfig({
      apiKey: 'AIzaSy_test',
      authDomain: 'my-project.firebaseapp.com',
      projectId: 'my-project',
      storageBucket: 'my-project.appspot.com',
      messagingSenderId: '123456',
      appId: '1:123:web:abc',
    })).toBe(true);
  });

  it('returns false when apiKey is missing', () => {
    expect(isValidFirestoreConfig({ projectId: 'p', appId: 'a' })).toBe(false);
  });

  it('returns false when projectId is missing', () => {
    expect(isValidFirestoreConfig({ apiKey: 'k', appId: 'a' })).toBe(false);
  });

  it('returns false when appId is missing', () => {
    expect(isValidFirestoreConfig({ apiKey: 'k', projectId: 'p' })).toBe(false);
  });

  it('returns false for empty string fields', () => {
    expect(isValidFirestoreConfig({ apiKey: '', projectId: 'p', appId: 'a' })).toBe(false);
    expect(isValidFirestoreConfig({ apiKey: 'k', projectId: '', appId: 'a' })).toBe(false);
    expect(isValidFirestoreConfig({ apiKey: 'k', projectId: 'p', appId: '' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidFirestoreConfig(null)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isValidFirestoreConfig('string')).toBe(false);
    expect(isValidFirestoreConfig(42)).toBe(false);
  });
});

// ── initFirebaseConfig / getFirestoreDb / resetFirebaseConfig ─────────────────

describe('firebaseConfig lifecycle', () => {
  beforeEach(() => {
    resetFirebaseConfig();
    mockApps.length = 0;
    vi.clearAllMocks();
  });

  it('getFirestoreDb returns null before initialization', () => {
    expect(getFirestoreDb()).toBeNull();
  });

  it('initFirebaseConfig returns a Firestore instance', () => {
    const db = initFirebaseConfig({ apiKey: 'k', projectId: 'p', appId: 'a' });
    expect(db).toBeDefined();
    expect(db).toBe(mockDb);
  });

  it('getFirestoreDb returns the instance after init', () => {
    initFirebaseConfig({ apiKey: 'k', projectId: 'p', appId: 'a' });
    expect(getFirestoreDb()).toBe(mockDb);
  });

  it('initFirebaseConfig is idempotent — second call reuses existing instance', () => {
    const db1 = initFirebaseConfig({ apiKey: 'k', projectId: 'p', appId: 'a' });
    const db2 = initFirebaseConfig({ apiKey: 'k2', projectId: 'p2', appId: 'a2' });
    expect(db1).toBe(db2);
  });

  it('resetFirebaseConfig makes getFirestoreDb return null again', () => {
    initFirebaseConfig({ apiKey: 'k', projectId: 'p', appId: 'a' });
    resetFirebaseConfig();
    expect(getFirestoreDb()).toBeNull();
  });

  it('initFirebaseConfig throws on invalid config', () => {
    expect(() => initFirebaseConfig({ apiKey: '', projectId: 'p', appId: 'a' })).toThrow();
  });
});

// ── toFirestoreDoc ────────────────────────────────────────────────────────────

describe('toFirestoreDoc', () => {
  it('converts an entry to a plain object', () => {
    const entry = { id: 1, date: '2025-01-01', time: '08:00', type: 'Formula', oz: 3 };
    const result = toFirestoreDoc(entry);
    expect(result).toEqual({ id: 1, date: '2025-01-01', time: '08:00', type: 'Formula', oz: 3 });
  });

  it('strips undefined fields', () => {
    const entry = { id: 1, date: '2025-01-01', time: '08:00', type: 'Breast L', oz: undefined };
    const result = toFirestoreDoc(entry);
    expect('oz' in result).toBe(false);
    expect(result.type).toBe('Breast L');
  });

  it('keeps null fields (only removes undefined)', () => {
    const entry = { id: 2, date: '2025-01-02', time: '09:00', notes: null as unknown as string };
    const result = toFirestoreDoc(entry);
    expect('notes' in result).toBe(true);
    expect(result.notes).toBeNull();
  });

  it('handles minimal entry with just required fields', () => {
    const entry = { id: 5, date: '2025-06-01' };
    const result = toFirestoreDoc(entry);
    expect(result).toEqual({ id: 5, date: '2025-06-01' });
  });
});

// ── fromFirestoreDoc ──────────────────────────────────────────────────────────

describe('fromFirestoreDoc', () => {
  it('restores a FeedEntry from a Firestore document', () => {
    const data = { id: 1, date: '2025-01-01', time: '08:00', type: 'Formula', oz: 3 };
    const entry = fromFirestoreDoc<{ id: number; date: string; oz: number }>(data);
    expect(entry.id).toBe(1);
    expect(entry.oz).toBe(3);
  });

  it('round-trips through toFirestoreDoc and fromFirestoreDoc', () => {
    const original = { id: 10, date: '2025-03-15', time: '14:30', type: 'Wet', peeAmount: 'large' };
    const roundTripped = toFirestoreDoc(original);
    const restored = fromFirestoreDoc<typeof original>(roundTripped);
    expect(restored).toEqual(original);
  });
});

// ── Encrypted-only API surface ────────────────────────────────────────────────
// Ensure no plaintext CRUD helpers are exported — encryption is mandatory.

describe('firestoreUtils exports only encrypted helpers (no plaintext write path)', () => {
  it('does not export unencrypted saveEntries', () => {
    expect('saveEntries' in firestoreUtils).toBe(false);
  });

  it('does not export unencrypted getEntries', () => {
    expect('getEntries' in firestoreUtils).toBe(false);
  });

  it('does not export unencrypted saveEntry', () => {
    expect('saveEntry' in firestoreUtils).toBe(false);
  });

  it('does not export unencrypted deleteEntry', () => {
    expect('deleteEntry' in firestoreUtils).toBe(false);
  });

  it('does not export saveFeedEntries (unencrypted category wrapper)', () => {
    expect('saveFeedEntries' in firestoreUtils).toBe(false);
  });

  it('does not export saveDiaperEntries (unencrypted category wrapper)', () => {
    expect('saveDiaperEntries' in firestoreUtils).toBe(false);
  });

  it('does not export saveSleepEntries (unencrypted category wrapper)', () => {
    expect('saveSleepEntries' in firestoreUtils).toBe(false);
  });

  it('does not export getFeedEntries (unencrypted category wrapper)', () => {
    expect('getFeedEntries' in firestoreUtils).toBe(false);
  });

  it('exports saveEntriesEncrypted as the only write path', () => {
    expect(typeof saveEntriesEncrypted).toBe('function');
  });

  it('exports getEntriesEncrypted as the only read path', () => {
    expect(typeof getEntriesEncrypted).toBe('function');
  });

  it('exports deleteEncryptedCategory for cleanup', () => {
    expect(typeof deleteEncryptedCategory).toBe('function');
  });
});

// ── saveEntriesEncrypted (encrypted write path) ───────────────────────────────

describe('saveEntriesEncrypted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a no-op when db is null', async () => {
    const entries = [{ id: 1, date: '2025-01-01', time: '08:00', type: 'Wet' as const, peeAmount: 'small' as const, pooAmount: 'none' as const, pooColor: 'yellow' as const }];
    await saveEntriesEncrypted(null, 'bloom-abc123', 'profile_1', 'diaper', entries);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('is a no-op when entries array is empty', async () => {
    await saveEntriesEncrypted(mockDb as never, 'bloom-abc123', 'profile_1', 'feed', []);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('uses the _encrypted document path (not per-entry paths)', async () => {
    const entries = [{ id: 1, date: '2025-01-01', time: '08:00', type: 'Wet' as const, peeAmount: 'small' as const, pooAmount: 'none' as const, pooColor: 'yellow' as const }];
    await saveEntriesEncrypted(mockDb as never, 'bloom-abc123', 'profile_1', 'diaper', entries);
    expect(doc).toHaveBeenCalledWith(mockCol, '_encrypted');
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('writes to the family-scoped collection path', async () => {
    const entries = [{ id: 1, date: '2025-01-01', time: '08:00', type: 'Wet' as const, peeAmount: 'small' as const, pooAmount: 'none' as const, pooColor: 'yellow' as const }];
    await saveEntriesEncrypted(mockDb as never, 'bloom-test', 'profile_1', 'sleep', entries);
    expect(collection).toHaveBeenCalledWith(mockDb, 'families', 'bloom-test', 'profiles', 'profile_1', 'sleep');
  });

  it('writes an object with ct, iv, and ts fields (encrypted payload shape)', async () => {
    const entries = [{ id: 42, date: '2025-06-01', time: '09:00', type: 'Wet' as const, peeAmount: 'large' as const, pooAmount: 'small' as const, pooColor: 'yellow' as const }];
    await saveEntriesEncrypted(mockDb as never, 'bloom-abc123', 'profile_1', 'diaper', entries);
    const written = vi.mocked(setDoc).mock.calls[0][1] as Record<string, unknown>;
    expect(typeof written.ct).toBe('string');
    expect(typeof written.iv).toBe('string');
    expect(typeof written.ts).toBe('number');
  });
});

// ── deleteEncryptedCategory ───────────────────────────────────────────────────

describe('deleteEncryptedCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a no-op when db is null', async () => {
    await deleteEncryptedCategory(null, 'bloom-abc123', 'profile_1', 'feed');
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it('deletes the _encrypted document for the given category', async () => {
    await deleteEncryptedCategory(mockDb as never, 'bloom-abc123', 'profile_1', 'sleep');
    expect(doc).toHaveBeenCalledWith(mockCol, '_encrypted');
    expect(deleteDoc).toHaveBeenCalledWith(mockDocRef);
  });

  it('deletes from the family-scoped collection path', async () => {
    await deleteEncryptedCategory(mockDb as never, 'bloom-xyz789', 'profile_2', 'diaper');
    expect(collection).toHaveBeenCalledWith(mockDb, 'families', 'bloom-xyz789', 'profiles', 'profile_2', 'diaper');
  });
});
