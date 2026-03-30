import { describe, it, expect, beforeEach } from 'vitest';
import { findUnmatchedSleep, type SleepEntry } from '@/lib/utils/date';

// Helper to build minimal SleepEntry objects with auto-incrementing IDs
let _id = 1000;
function entry(type: string, overrides: Partial<SleepEntry> = {}): SleepEntry {
  return { id: _id++, type, date: '2026-03-30', time: '08:00', ...overrides };
}

describe('findUnmatchedSleep', () => {
  beforeEach(() => { _id = 1000; });

  it('returns null for empty array', () => {
    expect(findUnmatchedSleep([])).toBeNull();
  });

  it('returns null when only non-sleep entries exist', () => {
    expect(findUnmatchedSleep([entry('Tummy Time'), entry('Bath')])).toBeNull();
  });

  it('returns the sleep entry when a single Nap has no Wake Up after it', () => {
    const nap = entry('Nap');
    expect(findUnmatchedSleep([nap])).toEqual(nap);
  });

  it('returns the sleep entry for Night Sleep with no Wake Up', () => {
    const ns = entry('Night Sleep');
    expect(findUnmatchedSleep([ns])).toEqual(ns);
  });

  it('returns null when the most recent entry is Wake Up (sleep already closed)', () => {
    const nap = entry('Nap');          // id 1000
    const wakeUp = entry('Wake Up');   // id 1001 — higher → sleep is closed
    expect(findUnmatchedSleep([nap, wakeUp])).toBeNull();
  });

  it('returns null regardless of array order — uses id not position', () => {
    const wakeUp = entry('Wake Up');   // id 1000
    const nap = entry('Nap', { id: 999 }); // lower id — was logged before Wake Up
    // nap.id (999) < wakeUp.id (1000) → Wake Up is most recent → closed
    expect(findUnmatchedSleep([wakeUp, nap])).toBeNull();
  });

  it('returns sleep entry when Wake Up has a LOWER id (sleep logged after wake-up — unusual edit scenario)', () => {
    const wakeUp = entry('Wake Up', { id: 999 });
    const nap = entry('Nap', { id: 1001 }); // higher id → most recent
    expect(findUnmatchedSleep([wakeUp, nap])).toEqual(nap);
  });

  it('returns null when two Wake Ups follow one Nap (the double-wake bug scenario)', () => {
    const nap = entry('Nap', { id: 1000 });
    const wake1 = entry('Wake Up', { id: 1001 });
    const wake2 = entry('Wake Up', { id: 1002 }); // second wake-up — most recent
    expect(findUnmatchedSleep([nap, wake1, wake2])).toBeNull();
  });

  it('returns the second Nap when a full sleep-wake cycle is followed by a new Nap', () => {
    const nap1 = entry('Nap', { id: 1000 });
    const wake1 = entry('Wake Up', { id: 1001 });
    const nap2 = entry('Nap', { id: 1002 }); // new unmatched nap
    expect(findUnmatchedSleep([nap1, wake1, nap2])).toEqual(nap2);
  });

  it('returns Night Sleep when it follows a completed nap cycle', () => {
    const nap = entry('Nap', { id: 1000 });
    const wake = entry('Wake Up', { id: 1001 });
    const nightSleep = entry('Night Sleep', { id: 1002 });
    expect(findUnmatchedSleep([nap, wake, nightSleep])).toEqual(nightSleep);
  });

  it('ignores non-sleep types when finding the latest entry', () => {
    const nap = entry('Nap', { id: 1000 });
    // A diaper/bath entry with a higher id should not count as "closing" the nap
    const diaper = entry('Wet', { id: 1005 });
    // findUnmatchedSleep only looks at Nap / Night Sleep / Wake Up types
    expect(findUnmatchedSleep([nap, diaper])).toEqual(nap);
  });
});

// ── Regression: double Wake Up must not double-count duration ──────────────
import { calcSleepMins } from '@/lib/utils/date';

describe('sleep duration regression — double Wake Up', () => {
  it('second Wake Up finds no unmatched sleep and gets 0 duration', () => {
    // Simulate the sequence: Nap → Wake Up → Wake Up
    const entries: SleepEntry[] = [
      { id: 1, type: 'Nap', date: '2026-03-30', time: '09:00' },
      { id: 2, type: 'Wake Up', date: '2026-03-30', time: '11:00' },
    ];

    // First Wake Up: unmatched sleep exists → duration computed correctly
    const beforeFirst = entries.slice(0, 1); // only the Nap
    const unmatched1 = findUnmatchedSleep(beforeFirst);
    expect(unmatched1).not.toBeNull();
    const dur1 = calcSleepMins(unmatched1!.date!, unmatched1!.time!, '2026-03-30', '11:00');
    expect(dur1).toBe(120);

    // Second Wake Up: the first Wake Up already closed the Nap
    const afterFirst = entries; // Nap + first Wake Up
    const unmatched2 = findUnmatchedSleep(afterFirst);
    expect(unmatched2).toBeNull(); // no open sleep → 0 duration, not 180
  });

  it('total sleep is not doubled when two Wake Ups are logged', () => {
    // Simulate what quickLog accumulates in sleepMinsToday
    const napStart = { id: 1, type: 'Nap', date: '2026-03-30', time: '09:00' };

    // First Wake Up (correct)
    const wake1Entries: SleepEntry[] = [napStart];
    const u1 = findUnmatchedSleep(wake1Entries);
    const dur1 = u1 ? calcSleepMins(u1.date!, u1.time!, '2026-03-30', '11:00') : 0;
    expect(dur1).toBe(120); // 2 hours

    // After first Wake Up is saved, entries become [Nap, WakeUp]
    const allEntries: SleepEntry[] = [
      napStart,
      { id: 2, type: 'Wake Up', date: '2026-03-30', time: '11:00' },
    ];

    // Second Wake Up should get 0 duration (no unmatched sleep)
    const u2 = findUnmatchedSleep(allEntries);
    const dur2 = u2 ? calcSleepMins(u2.date!, u2.time!, '2026-03-30', '12:00') : 0;
    expect(dur2).toBe(0); // not 180

    // Total should be 120, not 120 + 180 = 300
    expect(dur1 + dur2).toBe(120);
  });
});
