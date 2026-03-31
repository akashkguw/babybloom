/**
 * Unit tests for sleep state detection (isSleeping) as fixed in issue #166.
 *
 * Root cause: HomeTab.tsx used .find() on an ascending-sorted array (oldest first),
 * so a synced Wake Up at T2 was never seen — .find() stopped at the older
 * Nap/Night Sleep at T1. Fixed by using reduce() to find the entry with the maximum id.
 */
import { describe, it, expect } from 'vitest';

// ── Replicate the fixed HomeTab sleep detection logic ─────────────────────────

interface SleepEntry { id: number; type: string; date?: string; time?: string; }

function getLastSleepEntry(sleepLogs: SleepEntry[]): SleepEntry | undefined {
  return sleepLogs.reduce<SleepEntry | undefined>((max, e) => {
    if (e.type !== 'Nap' && e.type !== 'Night Sleep' && e.type !== 'Wake Up') return max;
    return (!max || e.id > max.id) ? e : max;
  }, undefined);
}

function isSleepingFromEntry(entry: SleepEntry | undefined): boolean {
  return !!(entry && (entry.type === 'Nap' || entry.type === 'Night Sleep'));
}

// ── Sleep state detection ─────────────────────────────────────────────────────

describe('sleep state detection — fixed max-id algorithm', () => {
  it('empty logs → not sleeping', () => {
    const entry = getLastSleepEntry([]);
    expect(isSleepingFromEntry(entry)).toBe(false);
  });

  it('only Nap → sleeping', () => {
    const logs = [{ id: 1000, type: 'Nap' }];
    const entry = getLastSleepEntry(logs);
    expect(isSleepingFromEntry(entry)).toBe(true);
  });

  it('only Night Sleep → sleeping', () => {
    const logs = [{ id: 1000, type: 'Night Sleep' }];
    const entry = getLastSleepEntry(logs);
    expect(isSleepingFromEntry(entry)).toBe(true);
  });

  it('only Wake Up → not sleeping', () => {
    const logs = [{ id: 1000, type: 'Wake Up' }];
    const entry = getLastSleepEntry(logs);
    expect(isSleepingFromEntry(entry)).toBe(false);
  });

  it('[Nap(T1), Wake Up(T2)] ascending order → not sleeping (regression case)', () => {
    const logs = [
      { id: 1000, type: 'Nap' },
      { id: 2000, type: 'Wake Up' },
    ];
    const entry = getLastSleepEntry(logs);
    expect(entry?.type).toBe('Wake Up');
    expect(isSleepingFromEntry(entry)).toBe(false);
  });

  it('[Wake Up(T2), Nap(T1)] prepended order (after local quickLog) → not sleeping', () => {
    const logs = [
      { id: 2000, type: 'Wake Up' },
      { id: 1000, type: 'Nap' },
    ];
    const entry = getLastSleepEntry(logs);
    expect(entry?.type).toBe('Wake Up');
    expect(isSleepingFromEntry(entry)).toBe(false);
  });

  it('[Nap(T1), Night Sleep(T2)] → sleeping (most recent is Night Sleep)', () => {
    const logs = [
      { id: 1000, type: 'Nap' },
      { id: 2000, type: 'Night Sleep' },
    ];
    const entry = getLastSleepEntry(logs);
    expect(entry?.type).toBe('Night Sleep');
    expect(isSleepingFromEntry(entry)).toBe(true);
  });

  it('multiple Wake Ups and Naps — most recent wins', () => {
    const logs = [
      { id: 1000, type: 'Nap' },
      { id: 2000, type: 'Wake Up' },
      { id: 3000, type: 'Night Sleep' },
      { id: 4000, type: 'Wake Up' },
    ];
    const entry = getLastSleepEntry(logs);
    expect(entry?.id).toBe(4000);
    expect(isSleepingFromEntry(entry)).toBe(false);
  });

  it('ignores unrelated log types (e.g. feed entries mixed in)', () => {
    const logs = [
      { id: 500, type: 'Formula' },
      { id: 1000, type: 'Nap' },
      { id: 1500, type: 'Breast L' },
    ];
    const entry = getLastSleepEntry(logs);
    expect(entry?.type).toBe('Nap');
    expect(isSleepingFromEntry(entry)).toBe(true);
  });

  it('multiple sessions: old Wake Up then new Nap → sleeping', () => {
    const local = [
      { id: 1000, type: 'Nap' },
      { id: 2000, type: 'Wake Up' },
      { id: 3000, type: 'Nap' },
    ];
    const entry = getLastSleepEntry(local);
    expect(entry?.id).toBe(3000);
    expect(isSleepingFromEntry(entry)).toBe(true);
  });
});
