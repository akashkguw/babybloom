/**
 * BabyBloom Cloud Sync — Family Key Manager
 *
 * Manages the family encryption key lifecycle:
 *   - Generate (first parent enables sync)
 *   - Store (IndexedDB for web; Keychain/Keystore for native via Capacitor)
 *   - Export/Import (BK1: QR code format for partner pairing)
 *   - Backup (PBKDF2-encrypted passphrase backup stored in Google Drive)
 *   - Restore (passphrase recovery on new device)
 *
 * Design §4.3 — Key Storage by Platform:
 *   iOS:     iOS Keychain (kSecAttrAccessibleAfterFirstUnlock)
 *   Android: Android Keystore
 *   Web/PWA: IndexedDB (same-origin protected; acceptable for zero-CDN app)
 *
 * This module handles the web/PWA path. Native paths call into Capacitor plugins.
 */

import { dg, ds } from '@/lib/db';
import {
  generateFamilyKey,
  exportKeyBytes,
  importKeyBytes,
  encryptKeyWithPassphrase,
  decryptKeyWithPassphrase,
} from './encryption';
import {
  DB_KEY_FAMILY_KEY,
  FAMILY_KEY_PREFIX,
  PASSPHRASE_MIN_LENGTH,
  PBKDF2_ITERATIONS,
} from './types';

// ═══ GENERATE ═══

/**
 * Generate a new 256-bit family key for a new sync family.
 * Called when the first parent taps "Enable Cloud Sync".
 */
export async function createFamilyKey(): Promise<CryptoKey> {
  return generateFamilyKey();
}

// ═══ STORE / LOAD (Web/PWA) ═══

/**
 * Persist the family key in IndexedDB (web/PWA path).
 * On native platforms, this would be replaced by Keychain/Keystore writes.
 */
export async function storeFamilyKey(key: CryptoKey): Promise<void> {
  const bytes = await exportKeyBytes(key);
  // Store as base64 string in IndexedDB
  await ds(DB_KEY_FAMILY_KEY, arrayToBase64(bytes));
}

/**
 * Load the family key from IndexedDB (web/PWA path).
 * Returns null if no key is stored (sync not yet set up).
 */
export async function loadFamilyKey(): Promise<CryptoKey | null> {
  const b64 = await dg(DB_KEY_FAMILY_KEY);
  if (!b64 || typeof b64 !== 'string') return null;

  try {
    const bytes = base64ToArray(b64);
    return importKeyBytes(bytes);
  } catch {
    return null;
  }
}

/**
 * Delete the family key from IndexedDB.
 * Called when sync is disabled and user chooses to remove cloud data.
 * The key remains in secure storage (for possible re-enable) if user just pauses sync.
 */
export async function deleteFamilyKey(): Promise<void> {
  await ds(DB_KEY_FAMILY_KEY, null);
}

/**
 * Check if a family key exists in storage (sync is set up).
 */
export async function hasFamilyKey(): Promise<boolean> {
  const b64 = await dg(DB_KEY_FAMILY_KEY);
  return typeof b64 === 'string' && b64.length > 0;
}

// ═══ QR CODE EXPORT / IMPORT (BK1: format) ═══

/**
 * Export the family key as a BK1: string for display in a QR code.
 * The QR code is shown to Parent A for scanning by Parent B.
 *
 * Format: "BK1:<base64-encoded 32 bytes>"
 *
 * SECURITY: This string gives full read/write access to all family data.
 * The UI must auto-dismiss the QR after 60 seconds and warn the user.
 */
export async function exportKeyForQR(key: CryptoKey): Promise<string> {
  const bytes = await exportKeyBytes(key);
  return `${FAMILY_KEY_PREFIX}${arrayToBase64(bytes)}`;
}

/**
 * Import a family key from a BK1: string (scanned QR or pasted text).
 * Returns null if the string is invalid.
 *
 * @param qrString - The raw string from the QR scan or clipboard
 */
export async function importKeyFromQR(qrString: string): Promise<CryptoKey | null> {
  try {
    // Normalize: trim whitespace, handle full-width colons, zero-width chars
    let cleaned = qrString.trim()
      .replace(/\u{FF1A}/gu, ':')
      .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '');

    // Find BK1: prefix (case-insensitive)
    const match = cleaned.match(/bk1\s*[:：]\s*/i);
    if (!match || match.index === undefined) return null;

    const b64 = cleaned.slice(match.index + match[0].length).trim()
      .replace(/[^A-Za-z0-9+/=]/g, '');

    if (!b64) return null;

    const bytes = base64ToArray(b64);
    if (bytes.length !== 32) return null; // AES-256 = 32 bytes

    return importKeyBytes(bytes);
  } catch {
    return null;
  }
}

// ═══ KEY BACKUP (PASSPHRASE-BASED) ═══

/**
 * Validate passphrase strength. Returns error message or null if valid.
 * Design §4.3.4: minimum 12 characters or 4+ word mnemonic.
 */
export function validatePassphrase(passphrase: string): string | null {
  if (!passphrase) return 'Passphrase is required';

  const wordCount = passphrase.trim().split(/\s+/).length;
  if (wordCount >= 4) return null; // 4-word mnemonic is acceptable

  if (passphrase.length < PASSPHRASE_MIN_LENGTH) {
    return `Passphrase must be at least ${PASSPHRASE_MIN_LENGTH} characters (or 4+ words)`;
  }

  return null;
}

/**
 * Create a passphrase-protected backup of the family key.
 * Returns a Uint8Array that should be uploaded to Google Drive as key_backup.enc.
 *
 * @param key - The family CryptoKey
 * @param passphrase - User's recovery passphrase (validated before calling)
 */
export async function createKeyBackup(
  key: CryptoKey,
  passphrase: string,
): Promise<Uint8Array> {
  const validationError = validatePassphrase(passphrase);
  if (validationError) throw new Error(validationError);

  return encryptKeyWithPassphrase(key, passphrase, PBKDF2_ITERATIONS);
}

/**
 * Restore a family key from a passphrase-protected backup.
 * Throws if the passphrase is wrong or the backup is corrupted.
 *
 * @param backup - The backup blob from Google Drive (key_backup.enc)
 * @param passphrase - User's recovery passphrase
 */
export async function restoreKeyFromBackup(
  backup: Uint8Array,
  passphrase: string,
): Promise<CryptoKey> {
  return decryptKeyWithPassphrase(backup, passphrase);
}

// ═══ KEY ROTATION ═══

/**
 * Generate a new family key for key rotation (design §8.7.4).
 * After rotation, all state files are re-encrypted with the new key,
 * and the revoked device can no longer decrypt new state files.
 *
 * The key_rotation.enc transition file is handled by the sync engine.
 */
export async function rotateKey(): Promise<CryptoKey> {
  return generateFamilyKey();
}

// ═══ BASE64 UTILITIES ═══

export function arrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArray(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
