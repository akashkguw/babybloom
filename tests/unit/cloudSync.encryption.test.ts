// @vitest-environment node

/**
 * BabyBloom Cloud Sync — Encryption Module Tests
 *
 * Tests for the AES-256-GCM encryption module and key management:
 *   - Roundtrip: encrypt → decrypt produces original plaintext
 *   - BB2 format: header validation, magic bytes, version
 *   - Wrong key: always fails with authentication error, no partial decryption
 *   - Corrupted data: authentication tag verification catches bit flips
 *   - Truncated data: rejected before decryption
 *   - JSON roundtrip helpers
 *   - Key export/import (raw bytes)
 *   - QR code format (BK1: prefix)
 *   - Passphrase backup: encrypt/decrypt roundtrip
 *   - Passphrase validation
 *   - isValidBB2Header
 */

import { describe, it, expect } from 'vitest';
import {
  generateFamilyKey,
  exportKeyBytes,
  importKeyBytes,
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
  isValidBB2Header,
  encryptKeyWithPassphrase,
  decryptKeyWithPassphrase,
  deriveKeyFromPassphrase,
} from '@/lib/sync/encryption';
import {
  exportKeyForQR,
  importKeyFromQR,
  validatePassphrase,
  arrayToBase64,
  base64ToArray,
} from '@/lib/sync/keyManager';
import { BB2_MAGIC, BB2_FORMAT_VERSION, BB2_HEADER_SIZE } from '@/lib/sync/types';

// ═══════════════════════════════════════════════════════
// GROUP 1: KEY GENERATION & EXPORT/IMPORT
// ═══════════════════════════════════════════════════════

describe('generateFamilyKey', () => {
  it('1. generates a non-null CryptoKey', async () => {
    const key = await generateFamilyKey();
    expect(key).toBeTruthy();
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
  });

  it('2. two generated keys are different', async () => {
    const a = await generateFamilyKey();
    const b = await generateFamilyKey();
    const aBytes = await exportKeyBytes(a);
    const bBytes = await exportKeyBytes(b);
    // Astronomically unlikely to be equal
    expect(aBytes).not.toEqual(bBytes);
  });

  it('3. exported key is 32 bytes (256 bits)', async () => {
    const key = await generateFamilyKey();
    const bytes = await exportKeyBytes(key);
    expect(bytes.length).toBe(32);
  });

  it('4. imported key can encrypt/decrypt', async () => {
    const original = await generateFamilyKey();
    const bytes = await exportKeyBytes(original);
    const imported = await importKeyBytes(bytes);
    const plaintext = new TextEncoder().encode('test data');
    const ciphertext = await encrypt(plaintext, imported);
    const decrypted = await decrypt(ciphertext, original);
    expect(decrypted).toEqual(plaintext);
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 2: ENCRYPT / DECRYPT ROUNDTRIP
// ═══════════════════════════════════════════════════════

describe('encrypt / decrypt', () => {
  it('5. roundtrip: encrypt then decrypt returns original plaintext', async () => {
    const key = await generateFamilyKey();
    const original = new TextEncoder().encode('Hello, BabyBloom!');
    const ciphertext = await encrypt(original, key);
    const decrypted = await decrypt(ciphertext, key);
    expect(decrypted).toEqual(original);
  });

  it('6. empty plaintext roundtrip works', async () => {
    const key = await generateFamilyKey();
    const original = new Uint8Array(0);
    const ciphertext = await encrypt(original, key);
    const decrypted = await decrypt(ciphertext, key);
    expect(decrypted).toEqual(original);
  });

  it('7. large plaintext (200KB) roundtrip', async () => {
    const key = await generateFamilyKey();
    // crypto.getRandomValues is limited to 65,536 bytes per Web Crypto spec;
    // use a deterministic pattern fill for large-data tests instead.
    const original = new Uint8Array(200 * 1024);
    for (let i = 0; i < original.length; i++) original[i] = i % 251; // prime modulus → varied pattern
    const ciphertext = await encrypt(original, key);
    const decrypted = await decrypt(ciphertext, key);
    expect(Array.from(decrypted)).toEqual(Array.from(original));
  });

  it('8. each encryption produces unique ciphertext (random IV)', async () => {
    const key = await generateFamilyKey();
    const plaintext = new TextEncoder().encode('same data');
    const c1 = await encrypt(plaintext, key);
    const c2 = await encrypt(plaintext, key);
    // IVs at bytes 6-17 should differ
    expect(c1.slice(6, 18)).not.toEqual(c2.slice(6, 18));
    expect(c1).not.toEqual(c2);
  });

  it('9. BB2 magic bytes are correct in output', async () => {
    const key = await generateFamilyKey();
    const ciphertext = await encrypt(new TextEncoder().encode('test'), key);
    expect(ciphertext[0]).toBe(0x42); // 'B'
    expect(ciphertext[1]).toBe(0x42); // 'B'
    expect(ciphertext[2]).toBe(0x32); // '2'
    expect(ciphertext[3]).toBe(0x00); // '\x00'
  });

  it('10. format version in header is 1 (big-endian uint16)', async () => {
    const key = await generateFamilyKey();
    const ciphertext = await encrypt(new TextEncoder().encode('test'), key);
    const view = new DataView(ciphertext.buffer);
    expect(view.getUint16(4, false)).toBe(BB2_FORMAT_VERSION);
  });

  it('11. output size = header(22) + plaintext_len + tag(16)', async () => {
    const key = await generateFamilyKey();
    const plaintext = new TextEncoder().encode('BabyBloom sync data');
    const ciphertext = await encrypt(plaintext, key);
    expect(ciphertext.length).toBe(BB2_HEADER_SIZE + plaintext.length + 16);
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 3: AUTHENTICATION / INTEGRITY
// ═══════════════════════════════════════════════════════

describe('decrypt — authentication failures', () => {
  it('12. wrong key always throws (never partial decryption)', async () => {
    const keyA = await generateFamilyKey();
    const keyB = await generateFamilyKey();
    const ciphertext = await encrypt(new TextEncoder().encode('secret'), keyA);
    await expect(decrypt(ciphertext, keyB)).rejects.toThrow('authentication failed');
  });

  it('13. single bit flip in ciphertext body throws auth error', async () => {
    const key = await generateFamilyKey();
    const ciphertext = await encrypt(new TextEncoder().encode('important data'), key);
    const tampered = new Uint8Array(ciphertext);
    tampered[BB2_HEADER_SIZE + 5] ^= 0x01; // flip one bit
    await expect(decrypt(tampered, key)).rejects.toThrow();
  });

  it('14. truncated ciphertext (missing auth tag) throws', async () => {
    const key = await generateFamilyKey();
    const ciphertext = await encrypt(new TextEncoder().encode('test'), key);
    const truncated = ciphertext.slice(0, ciphertext.length - 8); // remove half the tag
    await expect(decrypt(truncated, key)).rejects.toThrow();
  });

  it('15. wrong magic bytes in header throws', async () => {
    const key = await generateFamilyKey();
    const ciphertext = await encrypt(new TextEncoder().encode('test'), key);
    const tampered = new Uint8Array(ciphertext);
    tampered[0] = 0xFF; // corrupt magic
    await expect(decrypt(tampered, key)).rejects.toThrow('invalid magic bytes');
  });

  it('16. unsupported format version throws', async () => {
    const key = await generateFamilyKey();
    const ciphertext = await encrypt(new TextEncoder().encode('test'), key);
    const tampered = new Uint8Array(ciphertext);
    new DataView(tampered.buffer).setUint16(4, 99, false); // bogus version
    await expect(decrypt(tampered, key)).rejects.toThrow('unsupported format version');
  });

  it('17. data too short to be a valid BB2 file throws', async () => {
    const key = await generateFamilyKey();
    await expect(decrypt(new Uint8Array(10), key)).rejects.toThrow('too short');
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 4: JSON HELPERS
// ═══════════════════════════════════════════════════════

describe('encryptJSON / decryptJSON', () => {
  it('18. JSON roundtrip with simple object', async () => {
    const key = await generateFamilyKey();
    const data = { schema_version: 2, device_id: 'abc', logs: { feed: [] } };
    const encrypted = await encryptJSON(data, key);
    const decrypted = await decryptJSON<typeof data>(encrypted, key);
    expect(decrypted).toEqual(data);
  });

  it('19. JSON roundtrip with complex nested state', async () => {
    const key = await generateFamilyKey();
    const data = {
      schema_version: 2,
      device_id: 'uuid-v4-test',
      snapshot_at: new Date().toISOString(),
      logs: {
        feed: Array.from({ length: 50 }, (_, i) => ({
          id: i,
          date: '2026-01-01',
          time: '10:00',
          type: 'Formula',
          oz: 3.5,
          modified_at: new Date().toISOString(),
        })),
      },
    };
    const encrypted = await encryptJSON(data, key);
    const decrypted = await decryptJSON<typeof data>(encrypted, key);
    expect(decrypted.logs.feed.length).toBe(50);
    expect(decrypted.logs.feed[0].oz).toBe(3.5);
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 5: isValidBB2Header
// ═══════════════════════════════════════════════════════

describe('isValidBB2Header', () => {
  it('20. valid BB2 file passes', async () => {
    const key = await generateFamilyKey();
    const data = await encrypt(new TextEncoder().encode('test'), key);
    expect(isValidBB2Header(data)).toBe(true);
  });

  it('21. random bytes fail', () => {
    const random = crypto.getRandomValues(new Uint8Array(100));
    expect(isValidBB2Header(random)).toBe(false);
  });

  it('22. data shorter than header fails', () => {
    expect(isValidBB2Header(new Uint8Array(10))).toBe(false);
  });

  it('23. correct magic but wrong version fails', async () => {
    const key = await generateFamilyKey();
    const data = await encrypt(new TextEncoder().encode('test'), key);
    const tampered = new Uint8Array(data);
    new DataView(tampered.buffer).setUint16(4, 99, false);
    expect(isValidBB2Header(tampered)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 6: KEY BACKUP (PASSPHRASE)
// ═══════════════════════════════════════════════════════

describe('encryptKeyWithPassphrase / decryptKeyWithPassphrase', () => {
  it('24. backup and restore roundtrip', async () => {
    const key = await generateFamilyKey();
    const originalBytes = await exportKeyBytes(key);
    const backup = await encryptKeyWithPassphrase(key, 'correct-horse-battery-staple');
    const restored = await decryptKeyWithPassphrase(backup, 'correct-horse-battery-staple');
    const restoredBytes = await exportKeyBytes(restored);
    expect(restoredBytes).toEqual(originalBytes);
  });

  it('25. wrong passphrase throws authentication error', async () => {
    const key = await generateFamilyKey();
    const backup = await encryptKeyWithPassphrase(key, 'correct-horse-battery-staple');
    await expect(
      decryptKeyWithPassphrase(backup, 'wrong-passphrase-totally-wrong')
    ).rejects.toThrow();
  });

  it('26. different passphrases produce different backup blobs', async () => {
    const key = await generateFamilyKey();
    const b1 = await encryptKeyWithPassphrase(key, 'passphrase-one-abc-xyz');
    const b2 = await encryptKeyWithPassphrase(key, 'passphrase-two-abc-xyz');
    expect(b1).not.toEqual(b2);
  });

  it('27. same passphrase produces different blobs (random salt)', async () => {
    const key = await generateFamilyKey();
    const b1 = await encryptKeyWithPassphrase(key, 'same-passphrase-here-long');
    const b2 = await encryptKeyWithPassphrase(key, 'same-passphrase-here-long');
    expect(b1).not.toEqual(b2); // different salts
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 7: QR CODE FORMAT (BK1:)
// ═══════════════════════════════════════════════════════

describe('exportKeyForQR / importKeyFromQR', () => {
  it('28. exported QR string starts with BK1:', async () => {
    const key = await generateFamilyKey();
    const qr = await exportKeyForQR(key);
    expect(qr.startsWith('BK1:')).toBe(true);
  });

  it('29. imported key matches original', async () => {
    const original = await generateFamilyKey();
    const qr = await exportKeyForQR(original);
    const imported = await importKeyFromQR(qr);
    expect(imported).not.toBeNull();
    const origBytes = await exportKeyBytes(original);
    const importedBytes = await exportKeyBytes(imported!);
    expect(importedBytes).toEqual(origBytes);
  });

  it('30. invalid QR string returns null', async () => {
    expect(await importKeyFromQR('not a valid key')).toBeNull();
    expect(await importKeyFromQR('')).toBeNull();
    expect(await importKeyFromQR('BB1:somebase64==')).toBeNull(); // wrong prefix
  });

  it('31. QR import is tolerant of whitespace and full-width colons', async () => {
    const key = await generateFamilyKey();
    const qr = await exportKeyForQR(key);
    const withWhitespace = '  ' + qr.replace(':', '：') + '  ';
    const imported = await importKeyFromQR(withWhitespace);
    expect(imported).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 8: PASSPHRASE VALIDATION
// ═══════════════════════════════════════════════════════

describe('validatePassphrase', () => {
  it('32. short passphrase fails', () => {
    expect(validatePassphrase('tooshort')).not.toBeNull();
  });

  it('33. exactly 12 chars passes', () => {
    expect(validatePassphrase('abcdefghijkl')).toBeNull();
  });

  it('34. 4+ word mnemonic passes regardless of length', () => {
    expect(validatePassphrase('horse cat dog bird')).toBeNull();
  });

  it('35. empty passphrase fails', () => {
    expect(validatePassphrase('')).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 9: BASE64 UTILITIES
// ═══════════════════════════════════════════════════════

describe('arrayToBase64 / base64ToArray', () => {
  it('36. roundtrip preserves bytes', () => {
    const original = crypto.getRandomValues(new Uint8Array(32));
    const b64 = arrayToBase64(original);
    const restored = base64ToArray(b64);
    expect(restored).toEqual(original);
  });

  it('37. empty array roundtrip', () => {
    const original = new Uint8Array(0);
    const b64 = arrayToBase64(original);
    const restored = base64ToArray(b64);
    expect(restored).toEqual(original);
  });
});

// ═══════════════════════════════════════════════════════
// GROUP 10: PBKDF2 DETERMINISM
// ═══════════════════════════════════════════════════════

describe('deriveKeyFromPassphrase', () => {
  it('38. same passphrase + salt → same key material', async () => {
    const salt = new Uint8Array(16).fill(42);
    const k1 = await deriveKeyFromPassphrase('my-recovery-passphrase-long', salt, 1000);
    const k2 = await deriveKeyFromPassphrase('my-recovery-passphrase-long', salt, 1000);
    // Verify by encrypting with k1 and decrypting with k2
    const plaintext = new TextEncoder().encode('determinism check');
    const ciphertext = await encrypt(plaintext, k1);
    // k2 should be functionally identical — it was derived from same inputs
    // We verify by encrypting with k1 and decrypting with k2 (same material)
    const decrypted = await decrypt(ciphertext, k2);
    expect(decrypted).toEqual(plaintext);
  });

  it('39. different passphrase → different key (wrong decryption fails)', async () => {
    const salt = new Uint8Array(16).fill(42);
    const k1 = await deriveKeyFromPassphrase('correct-passphrase-long-enough', salt, 1000);
    const k2 = await deriveKeyFromPassphrase('wrong-passphrase-long-enough!', salt, 1000);
    const ciphertext = await encrypt(new TextEncoder().encode('secret'), k1);
    await expect(decrypt(ciphertext, k2)).rejects.toThrow();
  });
});
