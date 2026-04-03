import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  normalizeFeedTimer,
  findMostRecentFeed,
  getRecentFeedWithinMinutes,
} from '@/features/feeding/timerUtils';

describe('timerUtils', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes timer startDateStr/startTimeStr from startTime when missing', () => {
    const start = new Date(2026, 3, 2, 23, 58).getTime(); // Apr 2, 2026 23:58 local
    const normalized = normalizeFeedTimer({
      type: 'Breast L',
      startTime: start,
      startTimeStr: '',
    });
    expect(normalized).toMatchObject({
      type: 'Breast L',
      startDateStr: '2026-04-02',
      startTimeStr: '23:58',
    });
  });

  it('finds a cross-midnight recent feed within 30 minutes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 3, 0, 12)); // Apr 3, 2026 00:12

    const feeds = [
      { type: 'Breast L', date: '2026-04-02', time: '23:58' },
    ];

    const recent = getRecentFeedWithinMinutes(feeds, null, 30);
    expect(recent).not.toBeNull();
    expect(recent?.entry.type).toBe('Breast L');
  });

  it('ignores future-corrupted feed timestamps when choosing most recent feed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 3, 0, 20)); // Apr 3, 2026 00:20

    const feeds = [
      // Old bug shape: start time from previous day with stop date => future timestamp
      { type: 'Breast L', date: '2026-04-03', time: '23:58' },
      { type: 'Breast R', date: '2026-04-03', time: '00:10' },
    ];

    const recent = findMostRecentFeed(feeds);
    expect(recent?.entry.type).toBe('Breast R');
    expect(recent?.entry.time).toBe('00:10');
  });

  it('can use completion time for timed cross-midnight feeds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 3, 0, 20)); // Apr 3, 2026 00:20

    const feeds = [
      { type: 'Breast L', date: '2026-04-02', time: '23:58', mins: 10 }, // ends at 00:08
      { type: 'Breast R', date: '2026-04-02', time: '22:00', mins: 20 }, // ends at 22:20
    ];

    const recentByStart = findMostRecentFeed(feeds, Date.now(), false);
    const recentByEnd = findMostRecentFeed(feeds, Date.now(), true);

    expect(recentByStart?.entry.type).toBe('Breast L');
    expect(recentByEnd?.entry.type).toBe('Breast L');
    const h = new Date(recentByEnd!.timestampMs).getHours();
    const m = new Date(recentByEnd!.timestampMs).getMinutes();
    expect(h).toBe(0);
    expect(m).toBe(8);
  });

  it('treats Breast L/R as merge-compatible for recent feed lookup', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 3, 9, 30));

    const feeds = [
      { type: 'Breast L', date: '2026-04-03', time: '09:10' },
    ];

    const recent = getRecentFeedWithinMinutes(feeds, 'Breast R', 30);
    expect(recent).not.toBeNull();
    expect(recent?.entry.type).toBe('Breast L');
  });
});
