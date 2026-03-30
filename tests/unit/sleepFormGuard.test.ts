/**
 * Tests for the Wake Up guard in the sleep log form (issue #175).
 *
 * The guard prevents submitting a Wake Up entry when no open sleep session
 * (unmatched Nap / Night Sleep) exists in the log.
 *
 * These tests exercise the underlying logic directly:
 *   - findUnmatchedSleep  → determines whether an open session exists
 *   - calcSleepMins       → computes the auto-filled duration
 *   - wakeUpBlocked       → derived boolean: blocked when Wake Up + no open session
 *
 * The component integrates these by computing:
 *   wakeUpBlocked = sub === 'sleep' && form.type === 'Wake Up' && !editId && unmatchedSleep === null
 */

import { describe, it, expect } from 'vitest';
import { findUnmatchedSleep, calcSleepMins, type SleepEntry } from '@/lib/utils/date';

// Mirrors the derivation in LogTab.tsx
function computeWakeUpBlocked(
  logEntries: SleepEntry[],
  formType: string,
  sub: string,
  editId: number | string | null
): boolean {
  if (sub !== 'sleep' || formType !== 'Wake Up') return false;
  if (editId !== null) return false; // never block edits
  return findUnmatchedSleep(logEntries) === null;
}

// ── Wake Up guard ────────────────────────────────────────────────────────────

describe('sleep form Wake Up guard', () => {
  it('blocks Wake Up when there are no sleep entries at all', () => {
    const blocked = computeWakeUpBlocked([], 'Wake Up', 'sleep', null);
    expect(blocked).toBe(true);
  });

  it('blocks Wake Up when the only entry is a Wake Up (no open session)', () => {
    const entries: SleepEntry[] = [
      { id: 1, type: 'Wake Up', date: '2026-03-30', time: '08:00' },
    ];
    const blocked = computeWakeUpBlocked(entries, 'Wake Up', 'sleep', null);
    expect(blocked).toBe(true);
  });

  it('blocks Wake Up when a complete Nap + Wake Up cycle has no new sleep start', () => {
    const entries: SleepEntry[] = [
      { id: 1, type: 'Nap', date: '2026-03-30', time: '09:00' },
      { id: 2, type: 'Wake Up', date: '2026-03-30', time: '11:00' },
    ];
    const blocked = computeWakeUpBlocked(entries, 'Wake Up', 'sleep', null);
    expect(blocked).toBe(true);
  });

  it('allows Wake Up when a Nap has no matching Wake Up (open session exists)', () => {
    const entries: SleepEntry[] = [
      { id: 1, type: 'Nap', date: '2026-03-30', time: '13:00' },
    ];
    const blocked = computeWakeUpBlocked(entries, 'Wake Up', 'sleep', null);
    expect(blocked).toBe(false);
  });

  it('allows Wake Up when a Night Sleep has no matching Wake Up', () => {
    const entries: SleepEntry[] = [
      { id: 1, type: 'Night Sleep', date: '2026-03-29', time: '22:00' },
    ];
    const blocked = computeWakeUpBlocked(entries, 'Wake Up', 'sleep', null);
    expect(blocked).toBe(false);
  });

  it('allows Wake Up after a full cycle when a new Nap was started', () => {
    const entries: SleepEntry[] = [
      { id: 1, type: 'Nap', date: '2026-03-30', time: '09:00' },
      { id: 2, type: 'Wake Up', date: '2026-03-30', time: '10:30' },
      { id: 3, type: 'Nap', date: '2026-03-30', time: '13:00' }, // new open session
    ];
    const blocked = computeWakeUpBlocked(entries, 'Wake Up', 'sleep', null);
    expect(blocked).toBe(false);
  });

  it('does NOT block when form type is Sleep (not Wake Up)', () => {
    const blocked = computeWakeUpBlocked([], 'Nap', 'sleep', null);
    expect(blocked).toBe(false);
  });

  it('does NOT block when sub is not sleep', () => {
    const blocked = computeWakeUpBlocked([], 'Wake Up', 'feed', null);
    expect(blocked).toBe(false);
  });

  it('does NOT block when editId is set (editing an existing Wake Up entry)', () => {
    // No open sleep session, but user is editing an existing Wake Up → must stay saveable
    const entries: SleepEntry[] = [
      { id: 1, type: 'Nap', date: '2026-03-30', time: '09:00' },
      { id: 2, type: 'Wake Up', date: '2026-03-30', time: '11:00' },
    ];
    const blocked = computeWakeUpBlocked(entries, 'Wake Up', 'sleep', 2);
    expect(blocked).toBe(false);
  });
});

// ── Duration auto-fill (regression: sleep 10pm → wake 6am = 8h 0m) ──────────

describe('sleep duration auto-fill', () => {
  it('correctly computes 8h 0m for sleep at 22:00 → wake at 06:00 next day', () => {
    const sleepDate = '2026-03-29';
    const sleepTime = '22:00';
    const wakeDate = '2026-03-30';
    const wakeTime = '06:00';
    const mins = calcSleepMins(sleepDate, sleepTime, wakeDate, wakeTime);
    expect(mins).toBe(480);
    expect(Math.floor(mins / 60)).toBe(8);
    expect(mins % 60).toBe(0);
  });

  it('pre-fills duration only when an open session exists', () => {
    const entries: SleepEntry[] = [
      { id: 1, type: 'Nap', date: '2026-03-30', time: '10:00' },
    ];
    const unmatched = findUnmatchedSleep(entries);
    expect(unmatched).not.toBeNull();

    const wakeDate = '2026-03-30';
    const wakeTime = '12:00';
    const mins = calcSleepMins(unmatched!.date!, unmatched!.time!, wakeDate, wakeTime);
    expect(mins).toBe(120); // 2 hours
  });

  it('returns 0 duration (no pre-fill) when no open session exists', () => {
    const entries: SleepEntry[] = [
      { id: 1, type: 'Nap', date: '2026-03-30', time: '09:00' },
      { id: 2, type: 'Wake Up', date: '2026-03-30', time: '11:00' },
    ];
    const unmatched = findUnmatchedSleep(entries);
    // No open session — component shows error and blocks submit
    expect(unmatched).toBeNull();
    // Duration for a null open session = 0 (no auto-fill)
    const mins = unmatched
      ? calcSleepMins(unmatched.date!, unmatched.time!, '2026-03-30', '13:00')
      : 0;
    expect(mins).toBe(0);
  });
});

// ── Regression: no regression on Nap / Night Sleep type detection ────────────

describe('sleep type guard does not affect Nap / Night Sleep entries', () => {
  it('Nap type is never blocked regardless of existing entries', () => {
    const entries: SleepEntry[] = []; // empty log
    expect(computeWakeUpBlocked(entries, 'Nap', 'sleep', null)).toBe(false);
  });

  it('Night Sleep type is never blocked', () => {
    const entries: SleepEntry[] = [
      { id: 1, type: 'Nap', date: '2026-03-30', time: '13:00' },
      { id: 2, type: 'Wake Up', date: '2026-03-30', time: '14:30' },
    ];
    expect(computeWakeUpBlocked(entries, 'Night Sleep', 'sleep', null)).toBe(false);
  });
});
