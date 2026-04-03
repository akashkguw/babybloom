import { describe, it, expect, vi, afterEach } from 'vitest';
import { mergeSnapshots } from '@/lib/sync/merge';
import type { StateSnapshot } from '@/lib/sync/types';

function makeSnapshot(
  deviceId: string,
  overrides: Partial<StateSnapshot> = {},
): StateSnapshot {
  return {
    schema_version: 2,
    device_id: deviceId,
    device_name: deviceId,
    snapshot_at: new Date().toISOString(),
    profile: { modified_at: new Date().toISOString() },
    logs: {
      feed: [],
      diaper: [],
      sleep: [],
      growth: [],
      temp: [],
      bath: [],
      massage: [],
      meds: [],
      allergy: [],
      pump: [],
      tummy: [],
    },
    firsts: [],
    teeth: {},
    milestones: {},
    vaccines: {},
    emergency_contacts: [],
    ...overrides,
  };
}

describe('cloud sync active timer merge', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the newest in-progress timer across devices', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 3, 12, 0));

    const local = makeSnapshot('local', {
      active_timer: {
        type: 'Breast L',
        start_time_ms: new Date(2026, 3, 3, 11, 40).getTime(),
        start_date: '2026-04-03',
        start_time: '11:40',
      },
    });
    const remote = makeSnapshot('remote', {
      active_timer: {
        type: 'Breast R',
        start_time_ms: new Date(2026, 3, 3, 11, 50).getTime(),
        start_date: '2026-04-03',
        start_time: '11:50',
      },
    });

    const result = mergeSnapshots(local, remote);
    expect(result.snapshot.active_timer?.type).toBe('Breast R');
    expect(result.snapshot.active_timer?.start_time).toBe('11:50');
  });

  it('clears active timer when a finalized entry at the same start time exists', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 3, 12, 30));

    const startMs = new Date(2026, 3, 3, 12, 0).getTime();
    const local = makeSnapshot('local', {
      logs: {
        feed: [{
          id: 1,
          type: 'Breast L',
          date: '2026-04-03',
          time: '12:00',
          mins: 20,
          modified_at: '2026-04-03T12:20:00.000Z',
          deleted_at: null,
        }],
        diaper: [],
        sleep: [],
        growth: [],
        temp: [],
        bath: [],
        massage: [],
        meds: [],
        allergy: [],
        pump: [],
        tummy: [],
      },
    });

    const remote = makeSnapshot('remote', {
      active_timer: {
        type: 'Breast L',
        start_time_ms: startMs,
        start_date: '2026-04-03',
        start_time: '12:00',
      },
    });

    const result = mergeSnapshots(local, remote);
    expect(result.snapshot.active_timer).toBeNull();
  });
});
