/**
 * Unit tests for src/utils/crypto.ts
 *
 * Tests AES-256-GCM encryption/decryption using the Web Crypto API.
 * jsdom provides a minimal crypto.subtle — these tests run in the
 * vitest jsdom environment with globalThis.crypto available.
 */
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, isEncryptedPayload, deriveKey } from '@/utils/crypto';

describe('crypto', () => {
  const familyCode = 'bloom-testcode';

  describe('deriveKey', () => {
    it('returns a CryptoKey', async () => {
      const key = await deriveKey(familyCode);
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
    });

    it('returns the same key for the same family code (cached)', async () => {
      const key1 = await deriveKey(familyCode);
      const key2 = await deriveKey(familyCode);
      expect(key1).toBe(key2);
    });
  });

  describe('encrypt + decrypt roundtrip', () => {
    it('roundtrips a simple object', async () => {
      const data = { id: 123, type: 'feed', amount: 100 };
      const payload = await encrypt(data, familyCode);
      const result = await decrypt(payload, familyCode);
      expect(result).toEqual(data);
    });

    it('roundtrips an array of entries', async () => {
      const data = [
        { id: 1, type: 'feed' },
        { id: 2, type: 'diaper' },
        { id: 3, type: 'sleep' },
      ];
      const payload = await encrypt(data, familyCode);
      const result = await decrypt(payload, familyCode);
      expect(result).toEqual(data);
    });

    it('roundtrips an empty array', async () => {
      const data: unknown[] = [];
      const payload = await encrypt(data, familyCode);
      const result = await decrypt(payload, familyCode);
      expect(result).toEqual([]);
    });

    it('produces different ciphertext for the same plaintext (random IV)', async () => {
      const data = { id: 1 };
      const p1 = await encrypt(data, familyCode);
      const p2 = await encrypt(data, familyCode);
      expect(p1.ct).not.toBe(p2.ct);
      expect(p1.iv).not.toBe(p2.iv);
    });

    it('fails to decrypt with a different family code', async () => {
      const data = { id: 1 };
      const payload = await encrypt(data, familyCode);
      await expect(decrypt(payload, 'bloom-wrongcode')).rejects.toThrow();
    });
  });

  describe('isEncryptedPayload', () => {
    it('returns true for valid payloads', () => {
      expect(isEncryptedPayload({ ct: 'abc', iv: 'def' })).toBe(true);
    });

    it('returns false for plain objects', () => {
      expect(isEncryptedPayload({ id: 1, type: 'feed' })).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isEncryptedPayload(null)).toBe(false);
      expect(isEncryptedPayload(undefined)).toBe(false);
    });

    it('returns false when ct or iv is not a string', () => {
      expect(isEncryptedPayload({ ct: 123, iv: 'def' })).toBe(false);
      expect(isEncryptedPayload({ ct: 'abc', iv: 456 })).toBe(false);
    });
  });
});
