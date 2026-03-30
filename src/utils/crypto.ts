/**
 * Client-side encryption for Firestore sync data.
 *
 * Uses AES-256-GCM via the Web Crypto API (zero dependencies).
 * The encryption key is deterministically derived from the family code
 * using PBKDF2 (100 000 iterations, SHA-256), so both devices sharing
 * the same family code can encrypt/decrypt without exchanging a secret.
 *
 * Each encrypted payload includes a random 12-byte IV, making every
 * ciphertext unique even for identical plaintext.
 *
 * Firestore documents store: { ciphertext: string, iv: string }
 * where both values are base64-encoded.
 */

// Fixed salt — fine because the family code itself is the secret material.
// Changing this would invalidate all previously encrypted data.
const PBKDF2_SALT = new TextEncoder().encode('babybloom-sync-v1');
const PBKDF2_ITERATIONS = 100_000;
const AES_KEY_LENGTH = 256;
const IV_BYTES = 12; // recommended for AES-GCM

// ── Key derivation cache ────────────────────────────────────────────────────

let _cachedCode: string | null = null;
let _cachedKey: CryptoKey | null = null;

/**
 * Derive an AES-256-GCM key from a family code using PBKDF2.
 * Result is cached per family code to avoid redundant derivations.
 */
export async function deriveKey(familyCode: string): Promise<CryptoKey> {
  if (_cachedCode === familyCode && _cachedKey) return _cachedKey;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(familyCode),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: PBKDF2_SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );

  _cachedCode = familyCode;
  _cachedKey = key;
  return key;
}

// ── Base64 helpers ──────────────────────────────────────────────────────────

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface EncryptedPayload {
  /** Base64-encoded ciphertext */
  ct: string;
  /** Base64-encoded 12-byte IV */
  iv: string;
}

/**
 * Encrypt a plain object (log entry / array of entries) to an EncryptedPayload.
 */
export async function encrypt(data: unknown, familyCode: string): Promise<EncryptedPayload> {
  const key = await deriveKey(familyCode);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  );

  return {
    ct: toBase64(ciphertext),
    iv: toBase64(iv.buffer),
  };
}

/**
 * Decrypt an EncryptedPayload back to the original object.
 */
export async function decrypt<T = unknown>(payload: EncryptedPayload, familyCode: string): Promise<T> {
  const key = await deriveKey(familyCode);
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.ct);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

/**
 * Check whether a Firestore document looks like an encrypted payload
 * (has ct and iv string fields).
 */
export function isEncryptedPayload(data: unknown): data is EncryptedPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as Record<string, unknown>).ct === 'string' &&
    typeof (data as Record<string, unknown>).iv === 'string'
  );
}
