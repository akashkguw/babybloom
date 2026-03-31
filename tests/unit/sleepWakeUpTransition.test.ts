/**
 * Tests for the night-sleep → wake-up transition bug (issue #188).
 *
 * Bug: LogTab's handleSubmit had:
 *   if (sub === 'sleep' && (!entry.type || entry.type === 'Wake Up')) {
 *     entry.type = autoSleepType(entry.time); // 'Nap' or 'Night Sleep'
 *   }
 * This silently converted Wake Up entries to Nap/Night Sleep on submit,
 * so the sleep session never ended.
 *
 * Fix: removed `|| entry.type === 'Wake Up'` from the guard — Wake Up is a
 * valid, explicitly chosen type and must pass through unmodified.
 */

import { describe, it, expect } from 'vitest';
import { findUnmatchedSleep, autoSleepType, calcSleepMins, type SleepEntry } from '@/lib/utils/date';

// ── Simulate the fixed handleSubmit type-guard ────────────────────────────────

/**
 * Mirrors the fixed logic from LogTab.tsx handleSubmit.
 * Returns the effective entry type after the guard runs.
 */
function applyTypeGuard(sub: string, entryType: string | undefined, time: string): string {
  let type = entryType;
  // Fixed guard: only default when type is missing, never override Wake Up
  if (sub === 'sleep' && !type) {
    type = autoSleepType(time);
  }
  return type ?? '';
}

/**
 * Mirrors the BUGGY logic from the original handleSubmit (before the fix).
 * Retained here to document and confirm the regression.
 */
function applyBuggyTypeGuard(sub: string, entryType: string | undefined, time: string): string {
  let type = entryType;
  if (sub === 'sleep' && (!type || type === 'Wake Up')) {
    type = autoSleepType(time);
  }
  return type ?? '';
}

// ── Regression: buggy guard converts Wake Up to Nap/Night Sleep ─────────────

describe('REGRESSION — original buggy guard silently overwrites Wake Up', () => {
  it('buggy guard converts Wake Up at 07:30 (daytime) to Nap', () => {
    const result = applyBuggyTypeGuard('sleep', 'Wake Up', '07:30');
    expect(result).toBe('Nap'); // bug: Wake Up → Nap
    expect(result).not.toBe('Wake Up');
  });

  it('buggy guard converts Wake Up at 22:00 (night) to Night Sleep', () => {
    const result = applyBuggyTypeGuard('sleep', 'Wake Up', '22:00');
    expect(result).toBe('Night Sleep'); // bug: Wake Up → Night Sleep
    expect(result).not.toBe('Wake Up');
  });
});

// ── Fixed guard: Wake Up passes through unchanged ─────────────────────────────

describe('fixed type guard — Wake Up is preserved on submit', () => {
  it('preserves Wake Up type at daytime wake', () => {
    const result = applyTypeGuard('sleep', 'Wake Up', '07:30');
    expect(result).toBe('Wake Up');
  });

  it('preserves Wake Up type at night wake', () => {
    const result = applyTypeGuard('sleep', 'Wake Up', '06:30');
    expect(result).toBe('Wake Up');
  });

  it('preserves Nap type (not a regression)', () => {
    const result = applyTypeGuard('sleep', 'Nap', '14:00');
    expect(result).toBe('Nap');
  });

  it('preserves Night Sleep type (not a regression)', () => {
    const result = applyTypeGuard('sleep', 'Night Sleep', '22:00');
    expect(result).toBe('Night Sleep');
  });

  it('defaults to Nap when no type provided at 14:00 (daytime)', () => {
    const result = applyTypeGuard('sleep', undefined, '14:00');
    expect(result).toBe('Nap');
  });

  it('defaults to Night Sleep when no type provided at 22:00 (night)', () => {
    const result = applyTypeGuard('sleep', undefined, '22:00');
    expect(result).toBe('Night Sleep');
  });

  it('does not touch non-sleep entries', () => {
    const result = applyTypeGuard('feed', 'Wake Up', '08:00');
    expect(result).toBe('Wake Up'); // feed guard not applied
  });
});

// ── isSleeping state machine: night sleep → wake up ends session ───────────

/**
 * Mirrors HomeTab's isSleeping derivation:
 * scan ALL entries for the highest-id one among Nap/Night Sleep/Wake Up;
 * isSleeping = true iff that entry is Nap or Night Sleep.
 */
function computeIsSleeping(entries: SleepEntry[]): boolean {
  let latest: SleepEntry | undefined;
  for (const e of entries) {
    if (e.type !== 'Nap' && e.type !== 'Night Sleep' && e.type !== 'Wake Up') continue;
    if (!latest || e.id > latest.id) latest = e;
  }
  if (!latest) return false;
  return latest.type === 'Nap' || latest.type === 'Night Sleep';
}

describe('isSleeping state machine — night sleep → wake up transition', () => {
  it('is true when only Night Sleep entry exists', () => {
    const entries: SleepEntry[] = [
      { id: 1, type: 'Night Sleep', date: '2026-03-30', time: '22:00' },
    ];
    expect(computeIsSleeping(entries)).toBe(true);
  });

  it('becomes false after Wake Up is stored with a higher id', () => {
    const entries: SleepEntry[] = [
      { id: 1, type: 'Night Sleep', date: '2026-03-30', time: '22:00' },
      { id: 2, type: 'Wake Up', date: '2026-03-31', time: '06:30' },
    ];
    expect(computeIsSleeping(entries)).toBe(false);
  });

  it('stays true if buggy handler stored Wake Up as Night Sleep (reproduces bug)', () => {
    // Simulate what happened before the fix: Wake Up was converted to Night Sleep
    const entries: SleepEntry[] = [
      { id: 1, type: 'Night Sleep', date: '2026-03-30', time: '22:00' },
      // Bug: entry type was overwritten to Night Sleep instead of Wake Up
      { id: 2, type: 'Night Sleep', date: '2026-03-31', time: '06:30' },
    ];
    expect(computeIsSleeping(entries)).toBe(true); // bug: still sleeping!
  });

  it('correctly ends nap session via Wake Up too (no regression)', () => {
    const entries: SleepEntry[] = [
      { id: 1, type: 'Nap', date: '2026-03-31', time: '14:00' },
      { id: 2, type: 'Wake Up', date: '2026-03-31', time: '15:30' },
    ];
    expect(computeIsSleeping(entries)).toBe(false);
  });

  it('returns true for Nap even after a prior full cycle', () => {
    const entries: SleepEntry[] = [
      { id: 1, type: 'Night Sleep', date: '2026-03-30', time: '22:00' },
      { id: 2, type: 'Wake Up', date: '2026-03-31', time: '06:30' },
      { id: 3, type: 'Nap', date: '2026-03-31', time: '13:00' },
    ];
    expect(computeIsSleeping(entries)).toBe(true);
  });
});

// ── End-to-end: start night sleep → log wake up → verify open session closed ──

describe('end-to-end: night sleep → wake up transition', () => {
  it('Wake Up submitted via fixed handleSubmit closes the night sleep session', () => {
    // Step 1: User quick-logs Night Sleep (HomeTab or LogTab)
    const nightSleep: SleepEntry = { id: 1000, type: 'Night Sleep', date: '2026-03-30', time: '21:00' };
    let sleepLog: SleepEntry[] = [nightSleep];

    expect(computeIsSleeping(sleepLog)).toBe(true); // baby is sleeping

    // Step 2: User opens LogTab sleep form and selects Wake Up pill
    // form.type is set to 'Wake Up' by the pill click handler
    const formType = 'Wake Up';
    const submitTime = '06:00';
    const submitDate = '2026-03-31';

    // Step 3: handleSubmit — apply the fixed type guard
    const effectiveType = applyTypeGuard('sleep', formType, submitTime);
    expect(effectiveType).toBe('Wake Up'); // must NOT be converted

    // Step 4: Entry is stored
    const wakeUpEntry: SleepEntry = { id: 1001, type: effectiveType, date: submitDate, time: submitTime };
    sleepLog = [nightSleep, wakeUpEntry];

    // Step 5: isSleeping re-evaluated → baby is now awake
    expect(computeIsSleeping(sleepLog)).toBe(false);
  });

  it('Wake Up duration is calculated correctly from night sleep start', () => {
    const unmatched = findUnmatchedSleep([
      { id: 1, type: 'Night Sleep', date: '2026-03-30', time: '21:00' },
    ]);
    expect(unmatched).not.toBeNull();

    const mins = calcSleepMins(unmatched!.date!, unmatched!.time!, '2026-03-31', '06:00');
    expect(mins).toBe(540); // 9 hours
  });

  it('Wake Up is blocked when baby is already awake (no unmatched sleep)', () => {
    const entries: SleepEntry[] = [
      { id: 1, type: 'Night Sleep', date: '2026-03-30', time: '21:00' },
      { id: 2, type: 'Wake Up', date: '2026-03-31', time: '06:00' },
    ];
    const unmatched = findUnmatchedSleep(entries);
    expect(unmatched).toBeNull(); // wakeUpBlocked would be true
  });
});
