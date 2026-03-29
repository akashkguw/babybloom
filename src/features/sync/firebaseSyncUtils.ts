/**
 * Firebase Autosync utilities — pure functions, no Firebase SDK dependency.
 * These can be unit-tested without mocking Firebase.
 */

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export interface LogEntry {
  id: number;
  date: string;
  time: string;
  type: string;
  [key: string]: unknown;
}

export interface Logs {
  feed?: LogEntry[];
  diaper?: LogEntry[];
  sleep?: LogEntry[];
  growth?: LogEntry[];
  temp?: LogEntry[];
  bath?: LogEntry[];
  massage?: LogEntry[];
  meds?: LogEntry[];
  allergy?: LogEntry[];
  tummy?: LogEntry[];
  [key: string]: LogEntry[] | undefined;
}

/**
 * Validates that a Firebase config has the minimum required fields.
 */
export function isValidFirebaseConfig(config: unknown): config is FirebaseConfig {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;
  return (
    typeof c.apiKey === 'string' && c.apiKey.length > 0 &&
    typeof c.databaseURL === 'string' && c.databaseURL.length > 0 &&
    typeof c.appId === 'string' && c.appId.length > 0
  );
}

/**
 * Validates a sync key — must be at least 4 chars, no Firebase-invalid path chars.
 */
export function isValidSyncKey(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  // Firebase RTDB paths must not contain '.', '#', '$', '[', ']'
  return trimmed.length >= 4 && !/[.#$[\]\/]/.test(trimmed);
}

/**
 * Parse a Firebase config from a JSON string (as pasted from Firebase console).
 * Accepts both raw JSON and JavaScript object literal syntax.
 */
export function parseFirebaseConfig(input: string): FirebaseConfig | null {
  const cleaned = input.trim()
    // Strip "const firebaseConfig = " and similar prefixes
    .replace(/^(const|var|let)\s+\w+\s*=\s*/, '')
    // Remove trailing semicolons
    .replace(/;$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    if (isValidFirebaseConfig(parsed)) return parsed;
    return null;
  } catch {
    // Convert JS object literal to JSON (unquoted keys → quoted keys)
    try {
      // Do NOT strip // line comments — it would corrupt URLs like https://...
      const jsonified = cleaned
        .replace(/,\s*([}\]])/g, '$1') // remove trailing commas
        .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":'); // quote keys
      const parsed = JSON.parse(jsonified);
      if (isValidFirebaseConfig(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Merge remote logs into local logs.
 * - Deduplicates by id, then by date+time+type combo.
 * - New entries are prepended; result is sorted newest-first.
 * Returns merged logs and the count of new entries added.
 */
export function mergeRemoteLogs(local: Logs, remote: Logs): { merged: Logs; newCount: number } {
  const merged: Logs = { ...local };
  let newCount = 0;

  for (const [cat, remoteEntries] of Object.entries(remote)) {
    if (!Array.isArray(remoteEntries) || remoteEntries.length === 0) continue;
    const localEntries = (merged[cat] || []) as LogEntry[];
    const localIds = new Set(localEntries.map((e) => e.id));
    const localKeys = new Set(localEntries.map((e) => `${e.date}|${e.time}|${e.type}`));

    const uniqueRemote = remoteEntries.filter(
      (e) => !localIds.has(e.id) && !localKeys.has(`${e.date}|${e.time}|${e.type}`)
    );
    newCount += uniqueRemote.length;

    if (uniqueRemote.length > 0) {
      merged[cat] = [...uniqueRemote, ...localEntries].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.time || '').localeCompare(a.time || '');
      });
    }
  }

  return { merged, newCount };
}

/**
 * Generate a random sync key with a "bb-" prefix (8 alphanumeric chars).
 */
export function generateSyncKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return 'bb-' + result;
}

/**
 * Firebase RTDB path for a given sync key and profile.
 * Example: "bb-abc12345/profile_1/logs"
 */
export function syncPath(syncKey: string, profileId: number | null): string {
  return `${syncKey}/profile_${profileId ?? 0}/logs`;
}
