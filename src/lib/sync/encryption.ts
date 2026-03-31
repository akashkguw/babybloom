/**
 * BabyBloom Cloud Sync — AES-256-GCM Encryption Module
 *
 * Implements the BB2 encrypted file format using Web Crypto API.
 * Zero-knowledge: the plaintext never leaves the device unencrypted.
 *
 * BB2 Binary Format:
 *   Bytes 0-3:   Magic "BB2\x00"
 *   Bytes 4-5:   Format version uint16 big-endian = 1
 *   Bytes 6-17:  IV (12 bytes, random per encryption)
 *   Bytes 18-21: Plaintext length uint32 big-endian
 *   Bytes 22-N:  AES-256-GCM ciphertext (includes 16-byte GCM auth tag at end)
 */

import {
  BB2_MAGIC,
  BB2_FORMAT_VERSION,
  BB2_HEADER_SIZE,
  BB2_IV_SIZE,
  BB2_TAG_SIZE,
} from './types';

// ═══ KEY GENERATION ═══

/**
 * Generate a new 256-bit AES-GCM family key using platform CSPRNG.
 * This is used when the first parent enables cloud sync.
 */
export async function generateFamilyKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,  // extractable — needed for QR export and key backup
    ['encrypt', 'decrypt'],
  );
}

/**
 * Export a CryptoKey to raw bytes (32 bytes for AES-256).
 */
export async function exportKeyBytes(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

/**
 * Import raw bytes (32 bytes) as an AES-GCM CryptoKey.
 */
export async function importKeyBytes(bytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

// ═══ ENCRYPT ═══

/**
 * Encrypt plaintext bytes using AES-256-GCM.
 * Returns a BB2-formatted Uint8Array ready for upload to Google Drive.
 *
 * @param plaintext - Raw bytes to encrypt
 * @param key - AES-256-GCM CryptoKey (family key)
 */
export async function encrypt(plaintext: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  // Generate a fresh random 12-byte IV for each encryption
  const iv = crypto.getRandomValues(new Uint8Array(BB2_IV_SIZE));

  // Encrypt with AES-256-GCM (produces ciphertext + 16-byte auth tag appended)
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    plaintext,
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);

  // Build BB2 header
  const totalSize = BB2_HEADER_SIZE + ciphertext.length;
  const output = new Uint8Array(totalSize);
  const view = new DataView(output.buffer);

  // Magic "BB2\x00"
  output.set(BB2_MAGIC, 0);

  // Format version (uint16 big-endian)
  view.setUint16(4, BB2_FORMAT_VERSION, false);

  // IV (12 bytes)
  output.set(iv, 6);

  // Plaintext length (uint32 big-endian)
  view.setUint32(18, plaintext.length, false);

  // Ciphertext (includes GCM auth tag)
  output.set(ciphertext, BB2_HEADER_SIZE);

  return output;
}

// ═══ DECRYPT ═══

/**
 * Decrypt a BB2-formatted blob using AES-256-GCM.
 * Validates magic bytes, format version, and GCM authentication tag.
 * Throws on any integrity failure — never returns partial decryption.
 *
 * @param data - BB2-formatted bytes from Google Drive
 * @param key - AES-256-GCM CryptoKey (family key)
 */
export async function decrypt(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  // Validate minimum size
  if (data.length < BB2_HEADER_SIZE + BB2_TAG_SIZE) {
    throw new Error('BB2 decrypt: data too short to be a valid BB2 file');
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Validate magic bytes "BB2\x00"
  for (let i = 0; i < BB2_MAGIC.length; i++) {
    if (data[i] !== BB2_MAGIC[i]) {
      throw new Error(`BB2 decrypt: invalid magic bytes at offset ${i}`);
    }
  }

  // Validate format version
  const version = view.getUint16(4, false);
  if (version !== BB2_FORMAT_VERSION) {
    throw new Error(`BB2 decrypt: unsupported format version ${version} (expected ${BB2_FORMAT_VERSION})`);
  }

  // Extract IV
  const iv = data.slice(6, 18);

  // Extract plaintext length (for validation after decryption)
  const expectedPlaintextLength = view.getUint32(18, false);

  // Extract ciphertext (includes GCM tag)
  const ciphertext = data.slice(BB2_HEADER_SIZE);

  // Decrypt — AES-GCM will throw if auth tag doesn't match (wrong key or corrupted data)
  let plaintextBuffer: ArrayBuffer;
  try {
    plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      ciphertext,
    );
  } catch {
    throw new Error('BB2 decrypt: authentication failed — wrong key or corrupted data');
  }

  const plaintext = new Uint8Array(plaintextBuffer);

  // Validate plaintext length matches header
  if (plaintext.length !== expectedPlaintextLength) {
    throw new Error(
      `BB2 decrypt: plaintext length mismatch — expected ${expectedPlaintextLength}, got ${plaintext.length}`,
    );
  }

  return plaintext;
}

// ═══ JSON HELPERS ═══

/**
 * Encrypt a JSON-serializable object to BB2 format.
 */
export async function encryptJSON<T>(data: T, key: CryptoKey): Promise<Uint8Array> {
  const json = JSON.stringify(data);
  const plaintext = new TextEncoder().encode(json);
  return encrypt(plaintext, key);
}

/**
 * Decrypt a BB2 blob and parse as JSON.
 * Throws if decryption fails or JSON is malformed.
 */
export async function decryptJSON<T>(data: Uint8Array, key: CryptoKey): Promise<T> {
  const plaintext = await decrypt(data, key);
  const json = new TextDecoder().decode(plaintext);
  return JSON.parse(json) as T;
}

// ═══ KEY BACKUP (PASSPHRASE-BASED) ═══

/**
 * Derive an AES-256-GCM wrapping key from a passphrase using PBKDF2-SHA256.
 * Used to create a passphrase-encrypted key backup.
 *
 * @param passphrase - User-chosen passphrase (min 12 chars enforced by UI)
 * @param salt - 16-byte random salt (generated fresh for each backup)
 * @param iterations - PBKDF2 iterations (100_000 minimum per design)
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = 100_000,
): Promise<CryptoKey> {
  const passphraseBytes = new TextEncoder().encode(passphrase);

  // Import passphrase as PBKDF2 base key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  // Derive AES-256-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable — wrapping key is derived on-demand
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt the family key with a passphrase for backup storage.
 * Returns a Uint8Array containing: salt(16) + BB2-encrypted family key bytes.
 *
 * @param familyKey - The family CryptoKey to back up
 * @param passphrase - User's recovery passphrase
 * @param iterations - PBKDF2 iterations
 */
export async function encryptKeyWithPassphrase(
  familyKey: CryptoKey,
  passphrase: string,
  iterations: number = 100_000,
): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrappingKey = await deriveKeyFromPassphrase(passphrase, salt, iterations);

  // Export family key to raw bytes
  const keyBytes = await exportKeyBytes(familyKey);

  // Pack: iterations(4 bytes BE) + salt(16 bytes) + encrypted key bytes
  const iterBytes = new Uint8Array(4);
  new DataView(iterBytes.buffer).setUint32(0, iterations, false);

  const encryptedKey = await encrypt(keyBytes, wrappingKey);

  // Output: iterations(4) + salt(16) + encryptedKey
  const output = new Uint8Array(4 + 16 + encryptedKey.length);
  output.set(iterBytes, 0);
  output.set(salt, 4);
  output.set(encryptedKey, 20);

  return output;
}

/**
 * Decrypt a passphrase-protected key backup.
 * Throws if passphrase is wrong or data is corrupted.
 *
 * @param backup - The backup blob (iterations + salt + BB2 encrypted key)
 * @param passphrase - User's recovery passphrase
 */
export async function decryptKeyWithPassphrase(
  backup: Uint8Array,
  passphrase: string,
): Promise<CryptoKey> {
  if (backup.length < 20 + BB2_HEADER_SIZE + BB2_TAG_SIZE) {
    throw new Error('Key backup: data too short');
  }

  const view = new DataView(backup.buffer, backup.byteOffset, backup.byteLength);
  const iterations = view.getUint32(0, false);
  const salt = backup.slice(4, 20);
  const encryptedKey = backup.slice(20);

  const wrappingKey = await deriveKeyFromPassphrase(passphrase, salt, iterations);
  const keyBytes = await decrypt(encryptedKey, wrappingKey);

  return importKeyBytes(keyBytes);
}

// ═══ INTEGRITY CHECK ═══

/**
 * Check if a Uint8Array appears to be a valid BB2 file (magic bytes match).
 * Does NOT verify the auth tag — use decrypt() for full validation.
 */
export function isValidBB2Header(data: Uint8Array): boolean {
  if (data.length < BB2_HEADER_SIZE) return false;
  for (let i = 0; i < BB2_MAGIC.length; i++) {
    if (data[i] !== BB2_MAGIC[i]) return false;
  }
  const version = new DataView(data.buffer, data.byteOffset).getUint16(4, false);
  return version === BB2_FORMAT_VERSION;
}
