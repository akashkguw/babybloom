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

const mockBatch = {
  set: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn(() => Promise.resolve()),
};

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => mockDb),
  collection: vi.fn(() => mockCol),
  doc: vi.fn(() => mockDocRef),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  writeBatch: vi.fn(() => mockBatch),
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
  saveEntry,
  saveEntries,
  getEntries,
  deleteEntry,
  getFeedEntries,
  getDiaperEntries,
} from '@/utils/firestoreUtils';

import { getDocs, setDoc, deleteDoc, writeBatch, collection, doc } from 'firebase/firestore';

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
    const doc = toFirestoreDoc(entry);
    expect(doc).toEqual({ id: 1, date: '2025-01-01', time: '08:00', type: 'Formula', oz: 3 });
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
    const doc = toFirestoreDoc(original);
    const restored = fromFirestoreDoc<typeof original>(doc);
    expect(restored).toEqual(original);
  });
});

// ── getEntries ────────────────────────────────────────────────────────────────

describe('getEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when db is null', async () => {
    const result = await getEntries(null, 'bloom-abc123', 'profile_1', 'feed');
    expect(result).toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('returns empty array when familyCode is empty', async () => {
    const result = await getEntries(mockDb as never, '', 'profile_1', 'feed');
    expect(result).toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('returns empty array when collection is empty', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as never);
    const result = await getEntries(mockDb as never, 'bloom-abc123', 'profile_1', 'feed');
    expect(result).toEqual([]);
  });

  it('maps Firestore documents to typed entries', async () => {
    const entry1 = { id: 1, date: '2025-01-01', time: '08:00', type: 'Formula', oz: 3 };
    const entry2 = { id: 2, date: '2025-01-01', time: '12:00', type: 'Breast L' };
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        { data: () => entry1 },
        { data: () => entry2 },
      ],
    } as never);

    const result = await getEntries(mockDb as never, 'bloom-abc123', 'profile_1', 'feed');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(entry1);
    expect(result[1]).toEqual(entry2);
  });

  it('calls collection with correct path parts including familyCode', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as never);
    await getEntries(mockDb as never, 'bloom-xyz789', 'profile_2', 'diaper');
    expect(collection).toHaveBeenCalledWith(mockDb, 'families', 'bloom-xyz789', 'profiles', 'profile_2', 'diaper');
  });
});

// ── saveEntry ─────────────────────────────────────────────────────────────────

describe('saveEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a no-op when db is null', async () => {
    await saveEntry(null, 'bloom-abc123', 'profile_1', 'feed', { id: 1, date: '2025-01-01' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('is a no-op when familyCode is empty', async () => {
    await saveEntry(mockDb as never, '', 'profile_1', 'feed', { id: 1, date: '2025-01-01' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('calls setDoc with the entry data', async () => {
    const entry = { id: 5, date: '2025-02-10', time: '10:00', type: 'Formula', oz: 4 };
    await saveEntry(mockDb as never, 'bloom-abc123', 'profile_1', 'feed', entry);
    expect(setDoc).toHaveBeenCalledWith(mockDocRef, toFirestoreDoc(entry));
  });

  it('uses entry id as the document id', async () => {
    const entry = { id: 42, date: '2025-03-01', time: '07:00' };
    await saveEntry(mockDb as never, 'bloom-abc123', 'profile_1', 'sleep', entry);
    expect(doc).toHaveBeenCalledWith(mockCol, '42');
  });
});

// ── saveEntries (batch) ───────────────────────────────────────────────────────

describe('saveEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatch.set.mockClear();
    mockBatch.commit.mockClear();
  });

  it('is a no-op when db is null', async () => {
    await saveEntries(null, 'bloom-abc123', 'profile_1', 'feed', [{ id: 1, date: '2025-01-01' }]);
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it('is a no-op when entries array is empty', async () => {
    await saveEntries(mockDb as never, 'bloom-abc123', 'profile_1', 'feed', []);
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it('calls batch.set for each entry and commits', async () => {
    const entries = [
      { id: 1, date: '2025-01-01', time: '08:00', type: 'Formula' as const },
      { id: 2, date: '2025-01-01', time: '12:00', type: 'Breast L' as const },
    ];
    await saveEntries(mockDb as never, 'bloom-abc123', 'profile_1', 'feed', entries);
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });
});

// ── deleteEntry ───────────────────────────────────────────────────────────────

describe('deleteEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a no-op when db is null', async () => {
    await deleteEntry(null, 'bloom-abc123', 'profile_1', 'feed', 1);
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it('calls deleteDoc with the correct doc ref', async () => {
    await deleteEntry(mockDb as never, 'bloom-abc123', 'profile_1', 'diaper', 7);
    expect(doc).toHaveBeenCalledWith(mockCol, '7');
    expect(deleteDoc).toHaveBeenCalledWith(mockDocRef);
  });
});

// ── Typed category helpers ────────────────────────────────────────────────────

describe('category-specific helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getFeedEntries passes "feed" as the category with familyCode', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as never);
    await getFeedEntries(mockDb as never, 'bloom-abc123', 'profile_1');
    expect(collection).toHaveBeenCalledWith(mockDb, 'families', 'bloom-abc123', 'profiles', 'profile_1', 'feed');
  });

  it('getDiaperEntries passes "diaper" as the category with familyCode', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as never);
    await getDiaperEntries(mockDb as never, 'bloom-abc123', 'profile_1');
    expect(collection).toHaveBeenCalledWith(mockDb, 'families', 'bloom-abc123', 'profiles', 'profile_1', 'diaper');
  });

  it('all helpers return empty array when db is null', async () => {
    expect(await getFeedEntries(null, 'bloom-abc123', 'p')).toEqual([]);
    expect(await getDiaperEntries(null, 'bloom-abc123', 'p')).toEqual([]);
  });
});
