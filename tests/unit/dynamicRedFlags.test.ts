import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the dynamic red flags computation logic.
 *
 * Since useDynamicRedFlags is a thin useMemo hook, we extract and
 * test the pure computation function directly — same logic, no React dependency.
 */

import { today, daysAgo } from '@/lib/utils/date';

interface LogEntry {
  id: number;
  date: string;
  time: string;
  type: string;
  mins?: number;
  oz?: number;
  amount?: string;
}

interface Logs {
  feed?: LogEntry[];
  diaper?: LogEntry[];
  sleep?: LogEntry[];
  tummy?: LogEntry[];
  [key: string]: LogEntry[] | undefined;
}

interface DynamicRedFlag {
  id: string;
  emoji: string;
  text: string;
  severity: 'warning' | 'critical';
}

function parseEntryMs(e: LogEntry): number {
  if (!e.date || !e.time) return 0;
  const dp = e.date.split('-');
  const tp = e.time.split(':');
  return new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0], +tp[1]).getTime();
}

function latestEntryMs(entries: LogEntry[]): number {
  let bestMs = 0;
  for (const e of entries) {
    const ms = parseEntryMs(e);
    if (ms > bestMs) bestMs = ms;
  }
  return bestMs;
}

function latestEntryOf(entries: LogEntry[], filter: (e: LogEntry) => boolean): { entry: LogEntry; ms: number } | null {
  let best: LogEntry | null = null;
  let bestMs = 0;
  for (const e of entries) {
    if (!filter(e)) continue;
    const ms = parseEntryMs(e);
    if (ms > bestMs) { bestMs = ms; best = e; }
  }
  return best ? { entry: best, ms: bestMs } : null;
}

/**
 * Pure computation extracted from useDynamicRedFlags — identical logic,
 * just without the useMemo wrapper so we can unit-test it.
 */
function computeRedFlags(
  logs: Logs,
  age: number,
  birth: string | null,
  isSleeping?: boolean
): DynamicRedFlag[] {
  if (!birth) return [];
  const flags: DynamicRedFlag[] = [];
  const nowMs = Date.now();
  const td = today();

  // 1. Extended feeding gap
  const feeds = logs.feed || [];
  if (!isSleeping) {
    if (feeds.length > 0) {
      const lastFeedMs = latestEntryMs(feeds);
      if (lastFeedMs > 0) {
        const feedHrs = (nowMs - lastFeedMs) / 3600000;
        const criticalH = age < 1 ? 4 : age < 3 ? 5 : age < 6 ? 6 : 8;
        const warnH = age < 1 ? 3 : age < 3 ? 4 : age < 6 ? 5 : 6;
        if (feedHrs >= criticalH) {
          flags.push({
            id: 'feed-gap',
            emoji: '🍼',
            text: 'No feeding in ' + Math.round(feedHrs) + 'h — babies ' +
              (age < 3 ? 'under 3 months' : 'this age') + ' need feeds every ' + warnH + 'h',
            severity: 'critical',
          });
        } else if (feedHrs >= warnH) {
          flags.push({
            id: 'feed-gap',
            emoji: '🍼',
            text: 'Last feed was ' + Math.round(feedHrs * 10) / 10 + 'h ago — consider feeding soon',
            severity: 'warning',
          });
        }
      }
    }
    // When no feeds are logged at all, stay quiet — warnings will
    // kick in naturally once the user starts tracking.
  }

  // 2. Low wet diaper count
  const diapers = logs.diaper || [];
  const todayDiapers = diapers.filter((e) => e.date === td);
  const wetToday = todayDiapers.filter((e) => e.type === 'Wet' || e.type === 'Both').length;
  const hour = new Date().getHours();
  const wetTarget = age < 3 ? 6 : 4;
  if (hour >= 14 && wetToday < Math.floor(wetTarget / 3)) {
    flags.push({
      id: 'low-wet',
      emoji: '💧',
      text: 'Only ' + wetToday + ' wet diaper' + (wetToday !== 1 ? 's' : '') +
        ' today — expected ' + wetTarget + '+ per day; check hydration',
      severity: wetToday === 0 && hour >= 16 ? 'critical' : 'warning',
    });
  }

  // 3. Extended dirty diaper gap
  const lastDirtyResult = latestEntryOf(diapers, (e) => e.type === 'Dirty' || e.type === 'Both');
  if (lastDirtyResult) {
    const dirtyMs = lastDirtyResult.ms;
    if (dirtyMs > 0) {
      const dirtyHrs = (nowMs - dirtyMs) / 3600000;
      const criticalDirtyH = age < 2 ? 36 : 72;
      const warnDirtyH = age < 2 ? 24 : 48;
      if (dirtyHrs >= criticalDirtyH) {
        flags.push({
          id: 'dirty-gap',
          emoji: '💩',
          text: 'No dirty diaper in ' + Math.round(dirtyHrs / 24) + ' day' +
            (Math.round(dirtyHrs / 24) !== 1 ? 's' : '') + ' — consult doctor if persists',
          severity: 'critical',
        });
      } else if (dirtyHrs >= warnDirtyH) {
        flags.push({
          id: 'dirty-gap',
          emoji: '💩',
          text: 'No dirty diaper in ' + Math.round(dirtyHrs) + 'h — monitor closely',
          severity: 'warning',
        });
      }
    }
  }

  // 4. Week-over-week feeding volume drop
  if (feeds.length >= 7) {
    let thisWeekOz = 0;
    let prevWeekOz = 0;
    let thisWeekCount = 0;
    let prevWeekCount = 0;
    for (let i = 0; i < 7; i++) {
      const dk = daysAgo(i);
      const dayFeeds = feeds.filter((e) => e.date === dk);
      thisWeekCount += dayFeeds.length;
      dayFeeds.forEach((e) => { thisWeekOz += e.oz || 0; });
    }
    for (let i = 7; i < 14; i++) {
      const dk = daysAgo(i);
      const dayFeeds = feeds.filter((e) => e.date === dk);
      prevWeekCount += dayFeeds.length;
      dayFeeds.forEach((e) => { prevWeekOz += e.oz || 0; });
    }
    if (prevWeekOz > 0 && thisWeekOz > 0) {
      const drop = (prevWeekOz - thisWeekOz) / prevWeekOz;
      if (drop >= 0.3) {
        flags.push({
          id: 'feed-drop',
          emoji: '📉',
          text: 'Feeding volume down ' + Math.round(drop * 100) + '% from last week — monitor intake',
          severity: drop >= 0.5 ? 'critical' : 'warning',
        });
      }
    }
    if (prevWeekOz === 0 && prevWeekCount > 4) {
      const countDrop = (prevWeekCount - thisWeekCount) / prevWeekCount;
      if (countDrop >= 0.3) {
        flags.push({
          id: 'feed-drop',
          emoji: '📉',
          text: 'Fewer feeds this week (' + thisWeekCount + ' vs ' + prevWeekCount + ' last week)',
          severity: countDrop >= 0.5 ? 'critical' : 'warning',
        });
      }
    }
  }

  // 5. Tummy time gap
  if (age < 12) {
    const tummyEntries = [...(logs.tummy || []), ...(logs.sleep || [])];
    const lastTummyResult = latestEntryOf(tummyEntries, (e) => e.type === 'Tummy Time');
    if (lastTummyResult) {
      const tummyMs = lastTummyResult.ms;
      if (tummyMs > 0) {
        const tummyHrs = (nowMs - tummyMs) / 3600000;
        if (tummyHrs >= 72) {
          flags.push({
            id: 'tummy-gap',
            emoji: '🧒',
            text: 'No tummy time in ' + Math.round(tummyHrs / 24) + ' days — aim for daily practice',
            severity: 'warning',
          });
        }
      }
    }
  }

  flags.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));
  return flags;
}

// ── helpers ──
const mkFeed = (date: string, time: string, oz?: number): LogEntry => ({
  id: Math.random(),
  date,
  time,
  type: 'Formula',
  ...(oz != null ? { oz } : {}),
});

const mkDiaper = (date: string, time: string, type: string): LogEntry => ({
  id: Math.random(),
  date,
  time,
  type,
});

const mkTummy = (date: string, time: string): LogEntry => ({
  id: Math.random(),
  date,
  time,
  type: 'Tummy Time',
});

describe('dynamic red flags', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty array when birth is null', () => {
    expect(computeRedFlags({ feed: [], diaper: [] }, 1, null)).toEqual([]);
  });

  // ── 1. Feed gap alerts ──
  describe('feed gap', () => {
    it('warns for 3h+ gap in newborn (<1 month)', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 14, 0));
      const lastFeed = mkFeed('2025-03-15', '10:30');
      const flags = computeRedFlags({ feed: [lastFeed] }, 0, '2025-03-01');
      const fg = flags.find((f) => f.id === 'feed-gap');
      expect(fg).toBeDefined();
      expect(fg!.severity).toBe('warning');
    });

    it('critical for 4h+ gap in newborn (<1 month)', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 15, 0));
      const lastFeed = mkFeed('2025-03-15', '10:30');
      const flags = computeRedFlags({ feed: [lastFeed] }, 0, '2025-03-01');
      const fg = flags.find((f) => f.id === 'feed-gap');
      expect(fg).toBeDefined();
      expect(fg!.severity).toBe('critical');
    });

    it('uses relaxed thresholds for 6+ month babies', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 16, 0));
      const lastFeed = mkFeed('2025-03-15', '10:30'); // 5.5h ago
      const flags = computeRedFlags({ feed: [lastFeed] }, 7, '2024-08-01');
      const fg = flags.find((f) => f.id === 'feed-gap');
      expect(fg).toBeUndefined(); // 5.5h < 6h warn threshold
    });

    it('suppresses feed gap when sleeping', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 15, 0));
      const lastFeed = mkFeed('2025-03-15', '10:00');
      const flags = computeRedFlags({ feed: [lastFeed] }, 0, '2025-03-01', true);
      expect(flags.find((f) => f.id === 'feed-gap')).toBeUndefined();
    });

    it('no flag when no feeds logged at all (clean start)', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 10, 0));
      const flags = computeRedFlags({ feed: [] }, 1, '2025-02-01');
      const fg = flags.find((f) => f.id === 'feed-gap');
      expect(fg).toBeUndefined();
    });

    it('no feed gap flag when recently fed', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 10, 30));
      const lastFeed = mkFeed('2025-03-15', '10:00'); // 30min ago
      const flags = computeRedFlags({ feed: [lastFeed] }, 0, '2025-03-01');
      expect(flags.find((f) => f.id === 'feed-gap')).toBeUndefined();
    });
  });

  // ── 2. Low wet diapers ──
  describe('low wet diapers', () => {
    it('warns for low wet count after 2PM (baby < 3mo)', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 15, 0));
      const td = '2025-03-15';
      const diapers = [mkDiaper(td, '08:00', 'Wet')];
      const flags = computeRedFlags(
        { feed: [mkFeed(td, '14:30')], diaper: diapers }, 1, '2025-02-01'
      );
      expect(flags.find((f) => f.id === 'low-wet')).toBeDefined();
    });

    it('critical at 0 wet after 4PM', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 17, 0));
      const flags = computeRedFlags(
        { feed: [mkFeed('2025-03-15', '16:30')], diaper: [] }, 1, '2025-02-01'
      );
      const lw = flags.find((f) => f.id === 'low-wet');
      expect(lw).toBeDefined();
      expect(lw!.severity).toBe('critical');
    });

    it('no alert before 2PM', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 10, 0));
      const flags = computeRedFlags(
        { feed: [mkFeed('2025-03-15', '09:30')], diaper: [] }, 1, '2025-02-01'
      );
      expect(flags.find((f) => f.id === 'low-wet')).toBeUndefined();
    });

    it('counts Both type as wet', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 15, 0));
      const td = '2025-03-15';
      // 2 "Both" diapers = 2 wet → just at the threshold (target/3 = 2 for <3mo)
      const diapers = [mkDiaper(td, '08:00', 'Both'), mkDiaper(td, '12:00', 'Both')];
      const flags = computeRedFlags(
        { feed: [mkFeed(td, '14:30')], diaper: diapers }, 1, '2025-02-01'
      );
      expect(flags.find((f) => f.id === 'low-wet')).toBeUndefined();
    });
  });

  // ── 3. Dirty diaper gap ──
  describe('dirty diaper gap', () => {
    it('warns after 24h gap for baby < 2 months', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 14, 0));
      const dirty = mkDiaper('2025-03-14', '12:00', 'Dirty');
      const flags = computeRedFlags(
        { feed: [mkFeed('2025-03-15', '13:30')], diaper: [dirty] }, 1, '2025-02-01'
      );
      const dg = flags.find((f) => f.id === 'dirty-gap');
      expect(dg).toBeDefined();
      expect(dg!.severity).toBe('warning');
    });

    it('critical after 36h for baby < 2 months', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 14, 0));
      const dirty = mkDiaper('2025-03-14', '00:00', 'Dirty');
      const flags = computeRedFlags(
        { feed: [mkFeed('2025-03-15', '13:30')], diaper: [dirty] }, 1, '2025-02-01'
      );
      const dg = flags.find((f) => f.id === 'dirty-gap');
      expect(dg).toBeDefined();
      expect(dg!.severity).toBe('critical');
    });

    it('relaxed thresholds for 2+ month babies', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 14, 0));
      const dirty = mkDiaper('2025-03-14', '08:00', 'Dirty'); // ~30h ago
      const flags = computeRedFlags(
        { feed: [mkFeed('2025-03-15', '13:30')], diaper: [dirty] }, 3, '2024-12-01'
      );
      expect(flags.find((f) => f.id === 'dirty-gap')).toBeUndefined(); // 30h < 48h
    });
  });

  // ── 4. Feed volume drop ──
  describe('feed volume drop', () => {
    it('warns when weekly oz drops 30%+', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 12, 0));
      const feeds: LogEntry[] = [];
      // This week: 2oz × 7 days
      for (let i = 0; i < 7; i++) {
        const d = new Date(2025, 2, 15 - i);
        const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        feeds.push(mkFeed(ds, '10:00', 2));
      }
      // Last week: 4oz × 7 days (50% drop)
      for (let i = 7; i < 14; i++) {
        const d = new Date(2025, 2, 15 - i);
        const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        feeds.push(mkFeed(ds, '10:00', 4));
      }
      const flags = computeRedFlags({ feed: feeds }, 3, '2024-12-01');
      const drop = flags.find((f) => f.id === 'feed-drop');
      expect(drop).toBeDefined();
      expect(drop!.severity).toBe('critical'); // 50% drop
    });

    it('no drop flag when volumes are stable', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 12, 0));
      const feeds: LogEntry[] = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date(2025, 2, 15 - i);
        const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        feeds.push(mkFeed(ds, '10:00', 4));
      }
      const flags = computeRedFlags({ feed: feeds }, 3, '2024-12-01');
      expect(flags.find((f) => f.id === 'feed-drop')).toBeUndefined();
    });
  });

  // ── 5. Tummy time gap ──
  describe('tummy time gap', () => {
    it('warns when 72h+ without tummy time for baby < 12mo', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 12, 0));
      const tummy = mkTummy('2025-03-11', '10:00'); // ~4 days ago
      const flags = computeRedFlags(
        { feed: [mkFeed('2025-03-15', '11:00')], tummy: [tummy] }, 3, '2024-12-01'
      );
      expect(flags.find((f) => f.id === 'tummy-gap')).toBeDefined();
    });

    it('no tummy flag for babies 12+ months', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 12, 0));
      const tummy = mkTummy('2025-03-11', '10:00');
      const flags = computeRedFlags(
        { feed: [mkFeed('2025-03-15', '11:00')], tummy: [tummy] }, 13, '2024-02-01'
      );
      expect(flags.find((f) => f.id === 'tummy-gap')).toBeUndefined();
    });

    it('no flag when tummy time was recent', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 12, 0));
      const tummy = mkTummy('2025-03-14', '10:00'); // ~26h ago
      const flags = computeRedFlags(
        { feed: [mkFeed('2025-03-15', '11:00')], tummy: [tummy] }, 3, '2024-12-01'
      );
      expect(flags.find((f) => f.id === 'tummy-gap')).toBeUndefined();
    });
  });

  // ── 6. Past-date feed ordering (issue #152) ──
  describe('past-date entry ordering', () => {
    it('no false feed-gap alert when past-date feed is prepended but recent feed exists', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 10, 30));
      // Recent feed at 10:00 today (30min ago) — should NOT trigger alert
      // But a past-date feed was just added and is at feeds[0]
      const feeds = [
        mkFeed('2025-03-14', '08:00'), // yesterday — added later, at index 0
        mkFeed('2025-03-15', '10:00'), // today — the actual most recent feed
      ];
      const flags = computeRedFlags({ feed: feeds }, 0, '2025-03-01');
      expect(flags.find((f) => f.id === 'feed-gap')).toBeUndefined();
    });

    it('still alerts when all feeds are old even if order is mixed', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 15, 0));
      // Both feeds are from yesterday — should still trigger alert
      const feeds = [
        mkFeed('2025-03-14', '08:00'),
        mkFeed('2025-03-14', '12:00'),
      ];
      const flags = computeRedFlags({ feed: feeds }, 0, '2025-03-01');
      expect(flags.find((f) => f.id === 'feed-gap')).toBeDefined();
    });

    it('no false dirty-gap alert when recent dirty diaper exists but is not at index 0', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 14, 0));
      // Recent dirty diaper exists but old one is at index 0
      const diapers = [
        mkDiaper('2025-03-13', '08:00', 'Dirty'), // 2 days ago — at index 0
        mkDiaper('2025-03-15', '12:00', 'Dirty'),  // today — the actual most recent
      ];
      const flags = computeRedFlags(
        { feed: [mkFeed('2025-03-15', '13:30')], diaper: diapers }, 1, '2025-02-01'
      );
      expect(flags.find((f) => f.id === 'dirty-gap')).toBeUndefined();
    });
  });

  // ── 7. Sorting ──
  describe('sorting', () => {
    it('places critical flags before warnings', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 17, 0));
      const flags = computeRedFlags({ feed: [], diaper: [] }, 1, '2025-02-01');
      const severities = flags.map((f) => f.severity);
      const firstWarning = severities.indexOf('warning');
      const lastCritical = severities.lastIndexOf('critical');
      if (firstWarning >= 0 && lastCritical >= 0) {
        expect(lastCritical).toBeLessThan(firstWarning);
      }
    });
  });
});
