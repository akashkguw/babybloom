import { describe, it, expect } from 'vitest';
import {
  isValidFirebaseConfig,
  isValidSyncKey,
  parseFirebaseConfig,
  mergeRemoteLogs,
  generateSyncKey,
  syncPath,
} from '@/features/sync/firebaseSyncUtils';
import type { Logs } from '@/features/sync/firebaseSyncUtils';

// ── isValidFirebaseConfig ─────────────────────────────────────────────────

describe('isValidFirebaseConfig', () => {
  it('returns true for a valid minimal config', () => {
    expect(isValidFirebaseConfig({
      apiKey: 'AIzaSy_test',
      authDomain: 'test.firebaseapp.com',
      databaseURL: 'https://test-default-rtdb.firebaseio.com',
      projectId: 'test',
      appId: '1:123:web:abc',
    })).toBe(true);
  });

  it('returns false when apiKey is missing', () => {
    expect(isValidFirebaseConfig({
      databaseURL: 'https://test.firebaseio.com',
      appId: '1:123:web:abc',
    })).toBe(false);
  });

  it('returns false when databaseURL is missing', () => {
    expect(isValidFirebaseConfig({
      apiKey: 'key',
      appId: '1:123:web:abc',
    })).toBe(false);
  });

  it('returns false when appId is missing', () => {
    expect(isValidFirebaseConfig({
      apiKey: 'key',
      databaseURL: 'https://test.firebaseio.com',
    })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidFirebaseConfig(null)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidFirebaseConfig('')).toBe(false);
  });

  it('returns false for empty apiKey', () => {
    expect(isValidFirebaseConfig({
      apiKey: '',
      databaseURL: 'https://test.firebaseio.com',
      appId: '1:123:web:abc',
    })).toBe(false);
  });
});

// ── isValidSyncKey ────────────────────────────────────────────────────────

describe('isValidSyncKey', () => {
  it('accepts a valid 4+ char alphanumeric key', () => {
    expect(isValidSyncKey('mykey')).toBe(true);
    expect(isValidSyncKey('bb-abc12345')).toBe(true);
    expect(isValidSyncKey('mybaby2025')).toBe(true);
  });

  it('rejects keys shorter than 4 characters', () => {
    expect(isValidSyncKey('abc')).toBe(false);
    expect(isValidSyncKey('ab')).toBe(false);
    expect(isValidSyncKey('')).toBe(false);
  });

  it('rejects keys with Firebase-invalid characters', () => {
    expect(isValidSyncKey('key.value')).toBe(false);
    expect(isValidSyncKey('key#value')).toBe(false);
    expect(isValidSyncKey('key$value')).toBe(false);
    expect(isValidSyncKey('key[0]')).toBe(false);
    expect(isValidSyncKey('key/path')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isValidSyncKey(null)).toBe(false);
    expect(isValidSyncKey(undefined)).toBe(false);
    expect(isValidSyncKey(1234)).toBe(false);
  });
});

// ── parseFirebaseConfig ───────────────────────────────────────────────────

describe('parseFirebaseConfig', () => {
  const validConfigJson = JSON.stringify({
    apiKey: 'AIzaSy_test',
    authDomain: 'test.firebaseapp.com',
    databaseURL: 'https://test-default-rtdb.firebaseio.com',
    projectId: 'test',
    appId: '1:123:web:abc',
  });

  it('parses a valid JSON string', () => {
    const result = parseFirebaseConfig(validConfigJson);
    expect(result).not.toBeNull();
    expect(result!.apiKey).toBe('AIzaSy_test');
  });

  it('parses a JS object literal with unquoted keys', () => {
    const jsLiteral = `{
      apiKey: "AIzaSy_test",
      authDomain: "test.firebaseapp.com",
      databaseURL: "https://test-default-rtdb.firebaseio.com",
      projectId: "test",
      appId: "1:123:web:abc"
    }`;
    const result = parseFirebaseConfig(jsLiteral);
    expect(result).not.toBeNull();
    expect(result!.databaseURL).toBe('https://test-default-rtdb.firebaseio.com');
  });

  it('strips "const firebaseConfig = " prefix', () => {
    const withPrefix = 'const firebaseConfig = ' + validConfigJson + ';';
    const result = parseFirebaseConfig(withPrefix);
    expect(result).not.toBeNull();
    expect(result!.appId).toBe('1:123:web:abc');
  });

  it('returns null for invalid JSON', () => {
    expect(parseFirebaseConfig('not json at all')).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    expect(parseFirebaseConfig('{"apiKey": "x"}')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseFirebaseConfig('')).toBeNull();
  });
});

// ── mergeRemoteLogs ───────────────────────────────────────────────────────

describe('mergeRemoteLogs', () => {
  const makeEntry = (id: number, date: string, time: string, type = 'Formula') => ({
    id, date, time, type,
  });

  it('adds new entries from remote that are not in local', () => {
    const local: Logs = { feed: [makeEntry(1, '2025-01-01', '08:00')] };
    const remote: Logs = { feed: [makeEntry(2, '2025-01-01', '10:00')] };
    const { merged, newCount } = mergeRemoteLogs(local, remote);
    expect(newCount).toBe(1);
    expect(merged.feed!.length).toBe(2);
  });

  it('does not duplicate entries with the same id', () => {
    const local: Logs = { feed: [makeEntry(1, '2025-01-01', '08:00')] };
    const remote: Logs = { feed: [makeEntry(1, '2025-01-01', '08:00')] };
    const { merged, newCount } = mergeRemoteLogs(local, remote);
    expect(newCount).toBe(0);
    expect(merged.feed!.length).toBe(1);
  });

  it('does not duplicate entries with the same date+time+type even if id differs', () => {
    const local: Logs = { feed: [makeEntry(1, '2025-01-01', '08:00')] };
    const remote: Logs = { feed: [makeEntry(99, '2025-01-01', '08:00')] };
    const { merged, newCount } = mergeRemoteLogs(local, remote);
    expect(newCount).toBe(0);
    expect(merged.feed!.length).toBe(1);
  });

  it('merges entries across multiple log categories', () => {
    const local: Logs = {
      feed: [makeEntry(1, '2025-01-01', '08:00')],
      diaper: [],
    };
    const remote: Logs = {
      feed: [makeEntry(2, '2025-01-01', '12:00')],
      diaper: [{ id: 10, date: '2025-01-01', time: '09:00', type: 'Wet' }],
    };
    const { merged, newCount } = mergeRemoteLogs(local, remote);
    expect(newCount).toBe(2);
    expect(merged.feed!.length).toBe(2);
    expect(merged.diaper!.length).toBe(1);
  });

  it('returns newCount=0 and unchanged merged when remote is empty', () => {
    const local: Logs = { feed: [makeEntry(1, '2025-01-01', '08:00')] };
    const { merged, newCount } = mergeRemoteLogs(local, {});
    expect(newCount).toBe(0);
    expect(merged.feed!.length).toBe(1);
  });

  it('sorts merged entries newest-first by date then time', () => {
    const local: Logs = { feed: [makeEntry(1, '2025-01-01', '10:00')] };
    const remote: Logs = { feed: [makeEntry(2, '2025-01-01', '14:00')] };
    const { merged } = mergeRemoteLogs(local, remote);
    expect(merged.feed![0].time).toBe('14:00');
    expect(merged.feed![1].time).toBe('10:00');
  });

  it('handles remote categories not present in local', () => {
    const local: Logs = { feed: [] };
    const remote: Logs = { sleep: [makeEntry(5, '2025-01-01', '21:00', 'Night')] };
    const { merged, newCount } = mergeRemoteLogs(local, remote);
    expect(newCount).toBe(1);
    expect(merged.sleep!.length).toBe(1);
  });
});

// ── generateSyncKey ───────────────────────────────────────────────────────

describe('generateSyncKey', () => {
  it('returns a string starting with "bb-"', () => {
    expect(generateSyncKey().startsWith('bb-')).toBe(true);
  });

  it('returns an 11-character key (bb- + 8 chars)', () => {
    expect(generateSyncKey().length).toBe(11);
  });

  it('generates unique keys on each call', () => {
    const keys = new Set(Array.from({ length: 20 }, generateSyncKey));
    expect(keys.size).toBeGreaterThan(15); // extremely unlikely to collide
  });

  it('generates keys that pass isValidSyncKey validation', () => {
    for (let i = 0; i < 10; i++) {
      expect(isValidSyncKey(generateSyncKey())).toBe(true);
    }
  });
});

// ── syncPath ──────────────────────────────────────────────────────────────

describe('syncPath', () => {
  it('constructs a path with the sync key and profile id', () => {
    expect(syncPath('bb-test12', 1)).toBe('bb-test12/profile_1/logs');
  });

  it('uses profile_0 when profileId is null', () => {
    expect(syncPath('bb-test12', null)).toBe('bb-test12/profile_0/logs');
  });
});
