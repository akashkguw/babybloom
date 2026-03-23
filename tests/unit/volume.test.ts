import { describe, it, expect } from 'vitest';
import { fmtVol, volLabel, ozToMl, mlToOz } from '@/lib/utils/volume';

describe('volume utils', () => {
  describe('mlToOz', () => {
    it('converts common baby feeding amounts accurately', () => {
      expect(mlToOz(60)).toBeCloseTo(2.03, 1);
      expect(mlToOz(120)).toBeCloseTo(4.06, 1);
      expect(mlToOz(150)).toBeCloseTo(5.07, 1);
      expect(mlToOz(180)).toBeCloseTo(6.09, 1);
      expect(mlToOz(240)).toBeCloseTo(8.12, 1);
    });

    it('round-trips ml → oz → ml within 1ml', () => {
      [60, 90, 120, 150, 180, 210, 240].forEach((ml) => {
        const oz = mlToOz(ml);
        const back = ozToMl(oz);
        expect(Math.abs(back - ml)).toBeLessThan(1);
      });
    });
  });

  describe('ozToMl', () => {
    it('converts common oz amounts accurately', () => {
      expect(ozToMl(2)).toBeCloseTo(59.15, 0);
      expect(ozToMl(4)).toBeCloseTo(118.29, 0);
      expect(ozToMl(6)).toBeCloseTo(177.44, 0);
      expect(ozToMl(8)).toBeCloseTo(236.59, 0);
    });
  });

  describe('fmtVol', () => {
    it('formats oz correctly', () => {
      expect(fmtVol(4, 'oz')).toBe('4 oz');
      expect(fmtVol(4.5, 'oz')).toBe('4.5 oz');
    });

    it('formats ml correctly', () => {
      expect(fmtVol(4.06, 'ml')).toBe('120 ml');
      expect(fmtVol(2.03, 'ml')).toBe('60 ml');
    });
  });

  describe('volLabel', () => {
    it('returns correct label', () => {
      expect(volLabel('oz')).toBe('oz');
      expect(volLabel('ml')).toBe('ml');
    });
  });
});
