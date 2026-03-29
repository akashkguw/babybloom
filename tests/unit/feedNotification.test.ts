import { describe, it, expect } from 'vitest';
import { checkFeedNotification, FeedEntry } from '@/lib/utils/feedNotification';

describe('checkFeedNotification', () => {
  const makeFeed = (date: string, time: string): FeedEntry => ({ date, time });

  // Fixed "now": 2025-03-15 14:00:00 local → use ms
  const baseDate = new Date(2025, 2, 15, 14, 0, 0);
  const nowMs = baseDate.getTime();

  describe('should notify', () => {
    it('fires when feed is overdue and no prior notification', () => {
      // Last feed was at 10:00, 4 hours ago, interval is 3h
      const feeds = [makeFeed('2025-03-15', '10:00')];
      const result = checkFeedNotification(feeds, 3, null, nowMs);
      expect(result.shouldNotify).toBe(true);
      expect(result.body).toContain('4 hours ago');
      expect(result.feedKey).toBe('2025-03-15_10:00');
    });

    it('fires when feed is exactly at interval boundary', () => {
      // Last feed 3h ago, interval is 3h
      const feeds = [makeFeed('2025-03-15', '11:00')];
      const result = checkFeedNotification(feeds, 3, null, nowMs);
      expect(result.shouldNotify).toBe(true);
      expect(result.feedKey).toBe('2025-03-15_11:00');
    });

    it('fires for a different feedKey even if previously notified for another', () => {
      // Previously notified for 08:00 feed, now latest feed is 10:00 and overdue
      const feeds = [makeFeed('2025-03-15', '10:00')];
      const result = checkFeedNotification(feeds, 3, '2025-03-15_08:00', nowMs);
      expect(result.shouldNotify).toBe(true);
      expect(result.feedKey).toBe('2025-03-15_10:00');
    });
  });

  describe('should NOT notify (dedup)', () => {
    it('does not fire when same feedKey was already notified', () => {
      // Last feed at 10:00, already notified for this exact feed
      const feeds = [makeFeed('2025-03-15', '10:00')];
      const result = checkFeedNotification(feeds, 3, '2025-03-15_10:00', nowMs);
      expect(result.shouldNotify).toBe(false);
    });

    it('does not fire when called multiple times with same feed (simulates re-open)', () => {
      const feeds = [makeFeed('2025-03-15', '10:00')];
      // First call — should fire
      const first = checkFeedNotification(feeds, 3, null, nowMs);
      expect(first.shouldNotify).toBe(true);
      // Second call with returned feedKey — should NOT fire
      const second = checkFeedNotification(feeds, 3, first.feedKey!, nowMs);
      expect(second.shouldNotify).toBe(false);
    });
  });

  describe('should NOT notify (not overdue)', () => {
    it('does not fire when feed is recent (under interval)', () => {
      // Last feed was at 12:00, only 2 hours ago, interval is 3h
      const feeds = [makeFeed('2025-03-15', '12:00')];
      const result = checkFeedNotification(feeds, 3, null, nowMs);
      expect(result.shouldNotify).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns shouldNotify false for empty feeds array', () => {
      const result = checkFeedNotification([], 3, null, nowMs);
      expect(result.shouldNotify).toBe(false);
    });

    it('returns shouldNotify false when feed has no date', () => {
      const feeds = [{ time: '10:00' } as FeedEntry];
      const result = checkFeedNotification(feeds, 3, null, nowMs);
      expect(result.shouldNotify).toBe(false);
    });

    it('returns shouldNotify false when feed has no time', () => {
      const feeds = [{ date: '2025-03-15' } as FeedEntry];
      const result = checkFeedNotification(feeds, 3, null, nowMs);
      expect(result.shouldNotify).toBe(false);
    });

    it('only checks the first (most recent) feed', () => {
      // First feed is recent (not overdue), second is old (overdue)
      const feeds = [
        makeFeed('2025-03-15', '13:00'), // 1h ago — not overdue
        makeFeed('2025-03-15', '08:00'), // 6h ago — overdue
      ];
      const result = checkFeedNotification(feeds, 3, null, nowMs);
      expect(result.shouldNotify).toBe(false);
    });

    it('handles feeds from previous days correctly', () => {
      // Feed from yesterday at 10:00 — 28 hours ago
      const feeds = [makeFeed('2025-03-14', '10:00')];
      const result = checkFeedNotification(feeds, 3, null, nowMs);
      expect(result.shouldNotify).toBe(true);
      expect(result.body).toContain('28 hours ago');
    });

    it('correctly rounds display hours to one decimal place', () => {
      // Last feed at 10:20 → 3h40m = 3.666...h → rounds to 3.7
      const feeds = [makeFeed('2025-03-15', '10:20')];
      const result = checkFeedNotification(feeds, 3, null, nowMs);
      expect(result.shouldNotify).toBe(true);
      expect(result.body).toContain('3.7 hours ago');
    });
  });
});
