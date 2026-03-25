import { describe, it, expect, vi } from 'vitest';
import { clampNum, safeNum, isValidBirthDate, isValidPhone, cleanStr, LIMITS } from '@/lib/utils/validate';

describe('validate utils', () => {
  // ── clampNum ──
  describe('clampNum', () => {
    it('returns empty string for empty input', () => {
      expect(clampNum('', 0, 100)).toBe('');
    });

    it('returns empty string for dash (negative sign)', () => {
      expect(clampNum('-', 0, 100)).toBe('');
    });

    it('returns empty string for non-numeric input', () => {
      expect(clampNum('abc', 0, 100)).toBe('');
    });

    it('clamps below minimum to min', () => {
      expect(clampNum('-5', 0, 100)).toBe('0');
    });

    it('clamps above maximum to max', () => {
      expect(clampNum('150', 0, 100)).toBe('100');
    });

    it('preserves valid input within range', () => {
      expect(clampNum('50', 0, 100)).toBe('50');
    });

    it('preserves user decimal formatting when valid', () => {
      expect(clampNum('4.5', 0, 20, 1)).toBe('4.5');
    });

    it('truncates excess decimal places', () => {
      expect(clampNum('4.567', 0, 20, 1)).toBe('4.6');
    });

    it('handles zero decimals', () => {
      expect(clampNum('4.5', 0, 20, 0)).toBe('5');
    });

    it('handles boundary values', () => {
      expect(clampNum('0', 0, 100)).toBe('0');
      expect(clampNum('100', 0, 100)).toBe('100');
    });
  });

  // ── safeNum ──
  describe('safeNum', () => {
    it('returns fallback for undefined', () => {
      expect(safeNum(undefined, 0, 100)).toBe(0);
    });

    it('returns fallback for empty string', () => {
      expect(safeNum('', 0, 100)).toBe(0);
    });

    it('returns fallback for NaN input', () => {
      expect(safeNum('abc', 0, 100)).toBe(0);
    });

    it('returns fallback for below-min', () => {
      expect(safeNum('-5', 0, 100)).toBe(0);
    });

    it('returns fallback for above-max', () => {
      expect(safeNum('150', 0, 100)).toBe(0);
    });

    it('returns parsed number for valid input', () => {
      expect(safeNum('42', 0, 100)).toBe(42);
    });

    it('returns custom fallback', () => {
      expect(safeNum('abc', 0, 100, 50)).toBe(50);
    });

    it('handles float values', () => {
      expect(safeNum('4.5', 0, 20)).toBe(4.5);
    });
  });

  // ── isValidBirthDate ──
  describe('isValidBirthDate', () => {
    it('returns false for empty string', () => {
      expect(isValidBirthDate('')).toBe(false);
    });

    it('returns false for invalid date format', () => {
      expect(isValidBirthDate('not-a-date')).toBe(false);
    });

    it('returns false for future date', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      const str = future.toISOString().slice(0, 10);
      expect(isValidBirthDate(str)).toBe(false);
    });

    it('returns false for date older than 5 years', () => {
      const old = new Date();
      old.setFullYear(old.getFullYear() - 6);
      const str = old.toISOString().slice(0, 10);
      expect(isValidBirthDate(str)).toBe(false);
    });

    it('returns true for today', () => {
      const d = new Date();
      const str = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      expect(isValidBirthDate(str)).toBe(true);
    });

    it('returns true for date within 5 years', () => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      const str = d.toISOString().slice(0, 10);
      expect(isValidBirthDate(str)).toBe(true);
    });
  });

  // ── isValidPhone ──
  describe('isValidPhone', () => {
    it('rejects short numbers (<7 digits)', () => {
      expect(isValidPhone('12345')).toBe(false);
    });

    it('rejects long numbers (>15 digits)', () => {
      expect(isValidPhone('1234567890123456')).toBe(false);
    });

    it('accepts valid 10-digit phone', () => {
      expect(isValidPhone('1234567890')).toBe(true);
    });

    it('strips formatting before checking', () => {
      expect(isValidPhone('+1 (234) 567-8901')).toBe(true);
      expect(isValidPhone('123-456-7890')).toBe(true);
    });

    it('accepts minimum valid (7 digits)', () => {
      expect(isValidPhone('1234567')).toBe(true);
    });

    it('accepts maximum valid (15 digits)', () => {
      expect(isValidPhone('123456789012345')).toBe(true);
    });
  });

  // ── cleanStr ──
  describe('cleanStr', () => {
    it('trims whitespace', () => {
      expect(cleanStr('  hello  ')).toBe('hello');
    });

    it('truncates to maxLen', () => {
      expect(cleanStr('hello world', 5)).toBe('hello');
    });

    it('uses default max of 200', () => {
      const long = 'a'.repeat(300);
      expect(cleanStr(long)).toHaveLength(200);
    });
  });

  // ── LIMITS ──
  describe('LIMITS', () => {
    it('has correct feed ranges', () => {
      expect(LIMITS.feedMins).toEqual({ min: 0, max: 120 });
      expect(LIMITS.feedOz).toEqual({ min: 0, max: 20 });
      expect(LIMITS.feedMl).toEqual({ min: 0, max: 600 });
    });

    it('has correct temperature ranges', () => {
      expect(LIMITS.tempF).toEqual({ min: 90, max: 110 });
      expect(LIMITS.tempC).toEqual({ min: 32, max: 43 });
    });

    it('has correct weight ranges', () => {
      expect(LIMITS.weightLbs).toEqual({ min: 1, max: 60 });
      expect(LIMITS.weightKg).toEqual({ min: 0.5, max: 27 });
    });

    it('has correct string length limits', () => {
      expect(LIMITS.nameLen).toBe(50);
      expect(LIMITS.noteLen).toBe(500);
    });
  });
});
