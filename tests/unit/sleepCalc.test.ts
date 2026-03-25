import { describe, it, expect } from 'vitest';
import { calcSleepMins } from '@/lib/utils/date';

describe('calcSleepMins', () => {
  it('same day nap: 14:00 to 15:30 = 90 min', () => {
    expect(calcSleepMins('2026-03-23', '14:00', '2026-03-23', '15:30')).toBe(90);
  });

  it('cross midnight: 21:00 to 06:00 next day = 540 min', () => {
    expect(calcSleepMins('2026-03-23', '21:00', '2026-03-24', '06:00')).toBe(540);
  });

  it('cross midnight: 23:00 to 07:00 next day = 480 min', () => {
    expect(calcSleepMins('2026-03-23', '23:00', '2026-03-24', '07:00')).toBe(480);
  });

  it('short nap: 30 min', () => {
    expect(calcSleepMins('2026-03-23', '13:00', '2026-03-23', '13:30')).toBe(30);
  });

  it('sleep at 22:00, wake at midnight = 120 min', () => {
    expect(calcSleepMins('2026-03-23', '22:00', '2026-03-24', '00:00')).toBe(120);
  });

  it('sleep at midnight, wake at 06:00 = 360 min', () => {
    expect(calcSleepMins('2026-03-24', '00:00', '2026-03-24', '06:00')).toBe(360);
  });

  it('over 24h returns 0', () => {
    expect(calcSleepMins('2026-03-22', '14:00', '2026-03-24', '14:00')).toBe(0);
  });

  it('wake before sleep returns 0', () => {
    expect(calcSleepMins('2026-03-24', '14:00', '2026-03-24', '13:00')).toBe(0);
  });

  it('same time returns 0', () => {
    expect(calcSleepMins('2026-03-24', '14:00', '2026-03-24', '14:00')).toBe(0);
  });

  it('same-ish time different days returns 0 (over 24h)', () => {
    expect(calcSleepMins('2026-03-23', '13:00', '2026-03-24', '14:00')).toBe(0);
  });

  it('overnight sleep computes correctly with dates', () => {
    expect(calcSleepMins('2026-03-23', '22:00', '2026-03-24', '06:00')).toBe(480);
  });
});
