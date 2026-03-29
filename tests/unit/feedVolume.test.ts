import { describe, it, expect } from 'vitest';
import { fmtVol, ozToMl, mlToOz } from '@/lib/utils/volume';

describe('feedOzToday summation logic', () => {
  // Mirror the exact logic used in HomeTab.tsx to compute feedOzToday
  function calcFeedOzToday(feeds: Array<{ date: string; oz?: number }>, td: string): number {
    let feedOzToday = 0;
    feeds
      .filter((x) => x.date === td && x.oz)
      .forEach((x) => {
        feedOzToday += x.oz || 0;
      });
    return feedOzToday;
  }

  it('sums oz from all feeds on the given date', () => {
    const feeds = [
      { date: '2026-03-29', oz: 2 },
      { date: '2026-03-29', oz: 3.5 },
      { date: '2026-03-29', oz: 1.5 },
    ];
    expect(calcFeedOzToday(feeds, '2026-03-29')).toBe(7);
  });

  it('excludes feeds from other dates', () => {
    const feeds = [
      { date: '2026-03-29', oz: 2 },
      { date: '2026-03-28', oz: 5 },
    ];
    expect(calcFeedOzToday(feeds, '2026-03-29')).toBe(2);
  });

  it('excludes feeds without oz field (breast feeds with duration only)', () => {
    const feeds = [
      { date: '2026-03-29', oz: 3 },
      { date: '2026-03-29' }, // breast feed with no oz
      { date: '2026-03-29', oz: 0 }, // oz=0 is falsy, excluded
    ];
    expect(calcFeedOzToday(feeds, '2026-03-29')).toBe(3);
  });

  it('returns 0 when no feeds exist for the date', () => {
    expect(calcFeedOzToday([], '2026-03-29')).toBe(0);
    expect(calcFeedOzToday([{ date: '2026-03-28', oz: 5 }], '2026-03-29')).toBe(0);
  });
});

describe('fmtVol', () => {
  it('formats oz as ml when unit is ml', () => {
    // 4 oz ≈ 118 ml
    expect(fmtVol(4, 'ml')).toBe('118 ml');
  });

  it('formats oz as oz when unit is oz', () => {
    expect(fmtVol(4, 'oz')).toBe('4 oz');
  });

  it('returns empty string for undefined input', () => {
    expect(fmtVol(undefined, 'ml')).toBe('');
  });

  it('rounds ml to whole number', () => {
    expect(fmtVol(1, 'ml')).toBe('30 ml');
  });

  it('handles zero oz', () => {
    expect(fmtVol(0, 'oz')).toBe('0 oz');
    expect(fmtVol(0, 'ml')).toBe('0 ml');
  });
});

describe('volume conversions', () => {
  it('ozToMl converts correctly', () => {
    expect(ozToMl(1)).toBeCloseTo(29.6, 0);
  });

  it('mlToOz converts correctly', () => {
    expect(mlToOz(30)).toBeCloseTo(1.01, 1);
  });

  it('round-trips are close', () => {
    const original = 120; // ml
    const oz = mlToOz(original);
    const back = ozToMl(oz);
    expect(back).toBeCloseTo(original, 0);
  });
});
