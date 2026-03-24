/**
 * useDataRedFlags – data-driven red flag alerts
 *
 * Computes red flags from recent log data (feeding, diaper, sleep)
 * and returns only the flags that are currently relevant.
 * Returns an empty array when everything looks fine → the carousel
 * slide should not render at all in that case.
 *
 * Wrapped in useMemo so it only recalculates when logs/age change.
 */
import { useMemo } from 'react';

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

export interface RedFlagItem {
  emoji: string;
  text: string;
}

function parseEntryTime(e: LogEntry): number {
  if (!e.date || !e.time) return 0;
  const dp = e.date.split('-');
  const tp = e.time.split(':');
  return new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0], +tp[1]).getTime();
}

function today(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function hoursAgo(ms: number): number {
  return (Date.now() - ms) / 3600000;
}

function fmtH(h: number): string {
  return h < 1 ? Math.round(h * 60) + 'm' : Math.round(h) + 'h';
}

/**
 * Returns an array of data-driven red flag alerts.
 * Empty array = nothing concerning → don't show the slide.
 */
export default function useDataRedFlags(logs: Logs, age: number): RedFlagItem[] {
  return useMemo<RedFlagItem[]>(() => {
    const flags: RedFlagItem[] = [];
    const nowMs = Date.now();
    const td = today();

    // ── Feeding red flags ──
    const feeds = logs.feed || [];
    if (feeds.length > 0) {
      const lastFeedMs = parseEntryTime(feeds[0]);
      const feedHrs = lastFeedMs ? hoursAgo(lastFeedMs) : 999;
      // Age-based danger thresholds (hours)
      const dangerH = age < 3 ? 4 : age < 6 ? 5 : 6;
      if (feedHrs >= dangerH) {
        flags.push({
          emoji: '🍼',
          text: 'No feed logged in ' + fmtH(feedHrs) + ' — consider feeding soon',
        });
      }
    } else {
      // No feeds logged at all — flag only if profile has been active > 1 day
      // (we can't tell for sure, but empty logs are worth noting)
      flags.push({
        emoji: '🍼',
        text: 'No feeding data yet — log feeds to track patterns',
      });
    }

    // ── Diaper / hydration red flags ──
    const diapers = logs.diaper || [];
    const todayDiapers = diapers.filter((e) => e.date === td);
    const wetToday = todayDiapers.filter(
      (e) => e.type === 'Wet' || e.type === 'Both'
    ).length;
    const wetTarget = age < 3 ? 6 : 4;
    const hour = new Date().getHours();

    if (diapers.length > 0) {
      const lastDiaperMs = parseEntryTime(diapers[0]);
      const diaperHrs = lastDiaperMs ? hoursAgo(lastDiaperMs) : 999;
      if (diaperHrs >= 8) {
        flags.push({
          emoji: '💧',
          text: 'No diaper change logged in ' + fmtH(diaperHrs) + ' — check hydration',
        });
      } else if (wetToday < Math.floor(wetTarget / 2) && hour >= 14) {
        flags.push({
          emoji: '💧',
          text: 'Only ' + wetToday + ' wet diaper' + (wetToday !== 1 ? 's' : '') + ' today — target is ' + wetTarget + '+',
        });
      }
    }

    // ── Sleep red flags ──
    const sleeps = logs.sleep || [];
    const todaySleeps = sleeps.filter(
      (e) => e.date === td && e.mins && e.type !== 'Wake Up' && e.type !== 'Tummy Time'
    );
    let sleepMinsToday = 0;
    todaySleeps.forEach((e) => { sleepMinsToday += e.mins || 0; });
    const sleepHrs = sleepMinsToday / 60;
    const sleepTarget = age < 3 ? 16 : age < 6 ? 14 : age < 12 ? 13 : 12;

    if (sleepHrs < sleepTarget * 0.25 && hour >= 18) {
      flags.push({
        emoji: '😴',
        text: 'Very little sleep today (' + Math.round(sleepHrs * 10) / 10 + 'h of ~' + sleepTarget + 'h) — watch for overtiredness',
      });
    }

    // ── Tummy time red flag (for babies < 6 months) ──
    if (age < 6) {
      const tummyEntries = sleeps.filter((e) => e.type === 'Tummy Time');
      if (tummyEntries.length > 0) {
        const lastTummyMs = parseEntryTime(tummyEntries[0]);
        const tummyHrs = lastTummyMs ? hoursAgo(lastTummyMs) : 999;
        if (tummyHrs >= 72) {
          flags.push({
            emoji: '🤸',
            text: 'No tummy time in ' + Math.round(tummyHrs / 24) + ' days — aim for a few minutes daily',
          });
        }
      }
    }

    return flags;
  }, [logs, age]);
}
