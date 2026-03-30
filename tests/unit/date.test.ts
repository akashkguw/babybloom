import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  today,
  now,
  fmtTime,
  fmtDate,
  daysAgo,
  weekLabel,
  monthLabel,
  autoSleepType,
  calcSleepMins,
  getWeekStart,
  findUnmatchedSleep,
  type SleepEntry,
} from '@/lib/utils/date';

describe('date utils', () => {
  // ── today() ──
  describe('today', () => {
    it('returns YYYY-MM-DD format', () => {
      expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns correct date for a fixed point in time', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 2, 15)); // March 15, 2025
      expect(today()).toBe('2025-03-15');
      vi.useRealTimers();
    });

    it('zero-pads single-digit months and days', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 0, 5)); // Jan 5
      expect(today()).toBe('2025-01-05');
      vi.useRealTimers();
    });
  });

  // ── now() ──
  describe('now', () => {
    it('returns HH:MM format', () => {
      expect(now()).toMatch(/^\d{2}:\d{2}$/);
    });

    it('returns correct time for fixed point', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 0, 1, 14, 30));
      expect(now()).toBe('14:30');
      vi.useRealTimers();
    });

    it('zero-pads early hours', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 0, 1, 3, 5));
      expect(now()).toBe('03:05');
      vi.useRealTimers();
    });
  });

  // ── fmtTime() ──
  describe('fmtTime', () => {
    it('converts 24-hour to 12-hour AM/PM', () => {
      expect(fmtTime('14:30')).toBe('2:30 PM');
      expect(fmtTime('09:05')).toBe('9:05 AM');
      expect(fmtTime('00:00')).toBe('12:00 AM');
      expect(fmtTime('12:00')).toBe('12:00 PM');
      expect(fmtTime('23:59')).toBe('11:59 PM');
    });

    it('returns empty string for undefined/empty', () => {
      expect(fmtTime(undefined)).toBe('');
      expect(fmtTime('')).toBe('');
    });
  });

  // ── fmtDate() ──
  describe('fmtDate', () => {
    it('formats YYYY-MM-DD to MMM D', () => {
      const result = fmtDate('2025-03-23');
      expect(result).toContain('Mar');
      expect(result).toContain('23');
    });

    it('returns empty string for undefined/empty', () => {
      expect(fmtDate(undefined)).toBe('');
      expect(fmtDate('')).toBe('');
    });
  });

  // ── daysAgo() ──
  describe('daysAgo', () => {
    it('returns today when n=0', () => {
      expect(daysAgo(0)).toBe(today());
    });

    it('returns yesterday when n=1', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 2, 15));
      expect(daysAgo(1)).toBe('2025-03-14');
      vi.useRealTimers();
    });

    it('handles month boundary', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 2, 1)); // March 1
      expect(daysAgo(1)).toBe('2025-02-28');
      vi.useRealTimers();
    });
  });

  // ── weekLabel() ──
  describe('weekLabel', () => {
    it('returns M/D format', () => {
      expect(weekLabel('2025-03-15')).toBe('3/15');
      expect(weekLabel('2025-01-05')).toBe('1/5');
    });
  });

  // ── monthLabel() ──
  describe('monthLabel', () => {
    it('returns abbreviated month name', () => {
      expect(monthLabel('2025-01-15')).toBe('Jan');
      expect(monthLabel('2025-06-01')).toBe('Jun');
      expect(monthLabel('2025-12-31')).toBe('Dec');
    });
  });

  // ── autoSleepType() ──
  describe('autoSleepType', () => {
    it('returns Night Sleep for evening hours (19:00-23:59)', () => {
      expect(autoSleepType('19:00')).toBe('Night Sleep');
      expect(autoSleepType('21:30')).toBe('Night Sleep');
      expect(autoSleepType('23:59')).toBe('Night Sleep');
    });

    it('returns Night Sleep for early morning hours (00:00-06:59)', () => {
      expect(autoSleepType('00:00')).toBe('Night Sleep');
      expect(autoSleepType('03:30')).toBe('Night Sleep');
      expect(autoSleepType('06:59')).toBe('Night Sleep');
    });

    it('returns Nap for daytime hours (07:00-18:59)', () => {
      expect(autoSleepType('07:00')).toBe('Nap');
      expect(autoSleepType('12:00')).toBe('Nap');
      expect(autoSleepType('18:59')).toBe('Nap');
    });

    it('boundary: 07:00 is Nap, 06:59 is Night Sleep', () => {
      expect(autoSleepType('07:00')).toBe('Nap');
      expect(autoSleepType('06:59')).toBe('Night Sleep');
    });

    it('boundary: 18:59 is Nap, 19:00 is Night Sleep', () => {
      expect(autoSleepType('18:59')).toBe('Nap');
      expect(autoSleepType('19:00')).toBe('Night Sleep');
    });

    // ── entries-aware overload ──
    it('returns Sleep type (Nap) when no prior sleep entries exist — no unmatched sleep-start', () => {
      expect(autoSleepType([], '10:00')).toBe('Nap');
    });

    it('returns Sleep type (Night Sleep) when entries are empty and time is evening', () => {
      expect(autoSleepType([], '21:00')).toBe('Night Sleep');
    });

    it('returns Wake Up when an unmatched Nap exists in entries', () => {
      const entries: SleepEntry[] = [{ id: 1, type: 'Nap', date: '2026-03-30', time: '10:00' }];
      expect(autoSleepType(entries, '11:00')).toBe('Wake Up');
    });

    it('returns Wake Up when an unmatched Night Sleep exists in entries', () => {
      const entries: SleepEntry[] = [{ id: 1, type: 'Night Sleep', date: '2026-03-29', time: '22:00' }];
      expect(autoSleepType(entries, '06:00')).toBe('Wake Up');
    });

    it('returns Sleep type when sleep-start is already matched by a Wake Up', () => {
      const entries: SleepEntry[] = [
        { id: 1, type: 'Nap', date: '2026-03-30', time: '10:00' },
        { id: 2, type: 'Wake Up', date: '2026-03-30', time: '11:00' },
      ];
      expect(autoSleepType(entries, '12:00')).toBe('Nap');
    });

    it('returns Sleep type (not Wake Up) when two Wake Ups already closed the sleep', () => {
      const entries: SleepEntry[] = [
        { id: 1, type: 'Nap', date: '2026-03-30', time: '09:00' },
        { id: 2, type: 'Wake Up', date: '2026-03-30', time: '10:00' },
        { id: 3, type: 'Wake Up', date: '2026-03-30', time: '11:00' },
      ];
      // Double Wake Up should not result in a third Wake Up suggestion
      expect(autoSleepType(entries, '12:00')).toBe('Nap');
    });
  });

  // ── calcSleepMins() ──
  describe('calcSleepMins', () => {
    it('calculates same-day nap correctly', () => {
      expect(calcSleepMins('2025-03-15', '13:00', '2025-03-15', '14:30')).toBe(90);
    });

    it('calculates cross-midnight sleep correctly', () => {
      expect(calcSleepMins('2025-03-15', '21:00', '2025-03-16', '06:00')).toBe(540);
    });

    it('returns 0 for wake before sleep (negative duration)', () => {
      expect(calcSleepMins('2025-03-15', '14:00', '2025-03-15', '12:00')).toBe(0);
    });

    it('returns 0 for duration exceeding 24 hours', () => {
      expect(calcSleepMins('2025-03-15', '10:00', '2025-03-17', '12:00')).toBe(0);
    });

    it('returns 0 for identical sleep and wake times', () => {
      expect(calcSleepMins('2025-03-15', '10:00', '2025-03-15', '10:00')).toBe(0);
    });

    it('handles exactly 23h59m (under 24h limit)', () => {
      expect(calcSleepMins('2025-03-15', '00:00', '2025-03-15', '23:59')).toBe(1439);
    });

    it('handles short nap (15 minutes)', () => {
      expect(calcSleepMins('2025-03-15', '10:00', '2025-03-15', '10:15')).toBe(15);
    });
  });

  // ── getWeekStart() ──
  describe('getWeekStart', () => {
    it('returns Monday for a mid-week date', () => {
      // March 19, 2025 is a Wednesday
      expect(getWeekStart('2025-03-19')).toBe('2025-03-17');
    });

    it('returns same date if already Monday', () => {
      expect(getWeekStart('2025-03-17')).toBe('2025-03-17');
    });

    it('returns previous Monday for Sunday', () => {
      // March 23, 2025 is a Sunday
      expect(getWeekStart('2025-03-23')).toBe('2025-03-17');
    });
  });
});
