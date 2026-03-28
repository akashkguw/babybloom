/**
 * useDynamicRedFlags
 * Computes data-driven red flags from recent P0 (priority-0) log entries.
 * Returns an array of active red flags; empty array means nothing to show.
 *
 * P0 red flags are urgent health/care indicators derived from actual log data:
 * - Extended feeding gaps (age-appropriate thresholds)
 * - Low wet diaper count (dehydration risk)
 * - Extended dirty diaper gap (constipation indicator)
 * - Week-over-week feeding volume drop
 * - Extended period without tummy time
 *
 * Performance: All computations are memoized; no effect on load time.
 */
import { useMemo } from 'react';
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
  [key: string]: LogEntry[] | undefined;
}

export interface DynamicRedFlag {
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

export default function useDynamicRedFlags(
  logs: Logs,
  age: number,
  birth: string | null,
  isSleeping?: boolean
): DynamicRedFlag[] {
  return useMemo(() => {
    if (!birth) return [];
    const flags: DynamicRedFlag[] = [];
    const nowMs = Date.now();
    const td = today();

    // ── 0. Post-2yr: suppress all tracking alerts ──
    if (age >= 24) {
      return [];
    }

    // ── 0b. Long inactivity detection ──
    // If the most recent log across all categories is older than 3 days,
    // show a gentle "welcome back" instead of alarming gap alerts
    const allEntries = [
      ...(logs.feed || []),
      ...(logs.diaper || []),
      ...(logs.sleep || []),
    ];
    if (allEntries.length > 0) {
      let latestMs = 0;
      for (const e of allEntries) {
        const ms = parseEntryMs(e);
        if (ms > latestMs) latestMs = ms;
      }
      const inactiveDays = (nowMs - latestMs) / 86400000;
      if (inactiveDays >= 3) {
        flags.push({
          id: 'welcome-back',
          emoji: '👋',
          text: 'Welcome back! Pick up where you left off — tap any button to start logging again',
          severity: 'warning',
        });
        return flags;
      }
    }

    // ── 1. Extended feeding gap ──
    const feeds = logs.feed || [];
    // Suppress feed-gap flag when baby is sleeping
    if (!isSleeping) {
      if (feeds.length > 0) {
        const lastFeedMs = parseEntryMs(feeds[0]);
        if (lastFeedMs > 0) {
          const feedHrs = (nowMs - lastFeedMs) / 3600000;
          // Age-based critical thresholds (hours)
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

    // ── 2. Low wet diaper count (dehydration risk) ──
    const diapers = logs.diaper || [];
    const todayDiapers = diapers.filter((e) => e.date === td);
    const wetToday = todayDiapers.filter((e) => e.type === 'Wet' || e.type === 'Both').length;
    const hour = new Date().getHours();
    // Only flag if it's past noon and count is concerning
    const wetTarget = age < 3 ? 6 : 4;
    if (hour >= 14 && wetToday < Math.floor(wetTarget / 3)) {
      flags.push({
        id: 'low-wet',
        emoji: '💧',
        text: 'Only ' + wetToday + ' pee diaper' + (wetToday !== 1 ? 's' : '') +
          ' today — expected ' + wetTarget + '+ per day; check hydration',
        severity: wetToday === 0 && hour >= 16 ? 'critical' : 'warning',
      });
    }

    // ── 3. Extended dirty diaper gap (constipation) ──
    const lastDirty = diapers.find((e) => e.type === 'Dirty' || e.type === 'Both');
    if (lastDirty) {
      const dirtyMs = parseEntryMs(lastDirty);
      if (dirtyMs > 0) {
        const dirtyHrs = (nowMs - dirtyMs) / 3600000;
        // For babies < 6 weeks, no stool for 24h+ is notable; older babies can go longer
        const criticalDirtyH = age < 2 ? 36 : 72;
        const warnDirtyH = age < 2 ? 24 : 48;
        if (dirtyHrs >= criticalDirtyH) {
          flags.push({
            id: 'dirty-gap',
            emoji: '💩',
            text: 'No poop diaper in ' + Math.round(dirtyHrs / 24) + ' day' +
              (Math.round(dirtyHrs / 24) !== 1 ? 's' : '') + ' — consult doctor if persists',
            severity: 'critical',
          });
        } else if (dirtyHrs >= warnDirtyH) {
          flags.push({
            id: 'dirty-gap',
            emoji: '💩',
            text: 'No poop diaper in ' + Math.round(dirtyHrs) + 'h — monitor closely',
            severity: 'warning',
          });
        }
      }
    }

    // ── 4. Week-over-week feeding volume drop (>30%) ──
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
      // Check volume drop (if both weeks have oz data)
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
      // Check count drop if no oz data
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

    // ── 5. Extended no tummy time ──
    if (age < 12) {
      const tummyEntries = [...(logs.tummy || []), ...(logs.sleep || [])];
      const lastTummy = tummyEntries.find((e) => e.type === 'Tummy Time');
      if (lastTummy) {
        const tummyMs = parseEntryMs(lastTummy);
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

    // Sort: critical first, then warning
    flags.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));

    return flags;
  }, [logs, age, birth, isSleeping]);
}
