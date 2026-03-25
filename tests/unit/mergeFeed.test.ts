import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRecentFeed, mergeIntoLastFeed } from '@/features/feeding/mergeFeedSession';
import type { Logs, FeedEntry } from '@/features/feeding/mergeFeedSession';

describe('mergeFeedSession', () => {
  // ── getRecentFeed ──
  describe('getRecentFeed', () => {
    const makeFeeds = (minsAgo: number, type = 'Breast L'): Logs => {
      const d = new Date(Date.now() - minsAgo * 60000);
      return {
        feed: [{
          type,
          date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
          time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
          mins: 10,
        }],
      };
    };

    it('returns last feed if within 30 minutes', () => {
      const logs = makeFeeds(15); // 15 min ago
      expect(getRecentFeed(logs, null)).not.toBeNull();
    });

    it('returns null if last feed was over 30 minutes ago', () => {
      const logs = makeFeeds(35); // 35 min ago
      expect(getRecentFeed(logs, null)).toBeNull();
    });

    it('returns null for empty feed array', () => {
      expect(getRecentFeed({ feed: [] }, null)).toBeNull();
      expect(getRecentFeed({}, null)).toBeNull();
    });

    it('filters by type when specified', () => {
      const logs = makeFeeds(10, 'Breast L');
      expect(getRecentFeed(logs, 'Breast L')).not.toBeNull();
      expect(getRecentFeed(logs, 'Breast R')).toBeNull();
    });

    it('returns null when feed has no time/date', () => {
      const logs: Logs = { feed: [{ type: 'Formula', date: '', time: '' }] };
      expect(getRecentFeed(logs, null)).toBeNull();
    });
  });

  // ── mergeIntoLastFeed ──
  describe('mergeIntoLastFeed', () => {
    const baseLogs: Logs = {
      feed: [{
        type: 'Breast L',
        date: '2025-03-15',
        time: '10:00',
        mins: 10,
        amount: '10 min',
        notes: '',
      }],
    };

    it('adds extra minutes to existing feed', () => {
      const merged = mergeIntoLastFeed(baseLogs, 5, 'Breast L');
      expect(merged.feed![0].mins).toBe(15);
      expect(merged.feed![0].amount).toBe('15 min');
    });

    it('handles breast side switch (L → R)', () => {
      const merged = mergeIntoLastFeed(baseLogs, 8, 'Breast R');
      expect(merged.feed![0].type).toBe('Breast R'); // updated to latest side
      expect(merged.feed![0].mins).toBe(18);
      expect(merged.feed![0].notes).toContain('Breast R');
    });

    it('does not switch type for non-breast feeds', () => {
      const formulaLogs: Logs = {
        feed: [{
          type: 'Formula',
          date: '2025-03-15',
          time: '10:00',
          mins: 10,
          amount: '10 min',
        }],
      };
      const merged = mergeIntoLastFeed(formulaLogs, 5, 'Formula');
      expect(merged.feed![0].type).toBe('Formula');
    });

    it('returns unchanged logs when feed array is empty', () => {
      const empty: Logs = { feed: [] };
      const merged = mergeIntoLastFeed(empty, 5, 'Breast L');
      expect(merged.feed).toEqual([]);
    });

    it('preserves other feeds in the array', () => {
      const multiLogs: Logs = {
        feed: [
          { type: 'Breast L', date: '2025-03-15', time: '14:00', mins: 10 },
          { type: 'Formula', date: '2025-03-15', time: '10:00', mins: 5 },
        ],
      };
      const merged = mergeIntoLastFeed(multiLogs, 5, 'Breast L');
      expect(merged.feed!.length).toBe(2);
      expect(merged.feed![0].mins).toBe(15); // first one merged
      expect(merged.feed![1].mins).toBe(5);  // second unchanged
    });

    it('handles merge when previous mins is undefined', () => {
      const noMinsLogs: Logs = {
        feed: [{ type: 'Breast L', date: '2025-03-15', time: '10:00' }],
      };
      const merged = mergeIntoLastFeed(noMinsLogs, 10, 'Breast L');
      expect(merged.feed![0].mins).toBe(10); // 0 + 10
    });
  });
});
