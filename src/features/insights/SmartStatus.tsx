/**
 * Smart Glanceable Dashboard
 * Shows traffic-light status indicators instead of raw numbers.
 * One glance tells you: what needs attention, what's on track.
 */
import { useMemo } from 'react';
import { C } from '@/lib/constants/colors';
import { today, fmtTime } from '@/lib/utils/date';

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

interface SmartStatusProps {
  logs: Logs;
  age: number;
  birth: string | null;
}

interface StatusItem {
  label: string;
  emoji: string;
  status: 'good' | 'watch' | 'action';
  text: string;
  detail: string;
}

function parseEntryTime(e: LogEntry): number {
  if (!e.date || !e.time) return 0;
  const dp = e.date.split('-');
  const tp = e.time.split(':');
  return new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0], +tp[1]).getTime();
}

function hoursAgo(ms: number): number {
  return (Date.now() - ms) / 3600000;
}

/** Find the entry with the latest date+time (chronologically most recent) */
function latestEntry(entries: LogEntry[]): LogEntry | null {
  let best: LogEntry | null = null;
  let bestMs = 0;
  for (const e of entries) {
    const ms = parseEntryTime(e);
    if (ms > bestMs) { bestMs = ms; best = e; }
  }
  return best;
}

function fmtHoursAgo(h: number): string {
  if (h < 1) return Math.round(h * 60) + 'm ago';
  if (h < 24) return Math.round(h * 10) / 10 + 'h ago';
  return Math.round(h / 24) + 'd ago';
}

export default function SmartStatus({ logs, age, birth }: SmartStatusProps) {
  const items = useMemo<StatusItem[]>(() => {
    const result: StatusItem[] = [];
    const nowMs = Date.now();
    const td = today();

    // ─── Feeding status ───
    const feeds = logs.feed || [];
    const todayFeeds = feeds.filter((e) => e.date === td);
    const lastFeed = latestEntry(feeds);
    const lastFeedMs = lastFeed ? parseEntryTime(lastFeed) : 0;
    const feedHrs = lastFeedMs ? hoursAgo(lastFeedMs) : 999;

    // Age-based feed thresholds (hours between feeds)
    const feedWarn = age < 3 ? 3 : age < 6 ? 3.5 : 4;
    const feedDanger = age < 3 ? 4 : age < 6 ? 5 : 6;

    if (feedHrs >= feedDanger) {
      result.push({
        label: 'Feeding',
        emoji: '🍼',
        status: 'action',
        text: 'Feed now',
        detail: lastFeedMs ? 'Last: ' + fmtHoursAgo(feedHrs) : 'No feeds logged',
      });
    } else if (feedHrs >= feedWarn) {
      result.push({
        label: 'Feeding',
        emoji: '🍼',
        status: 'watch',
        text: 'Feed soon',
        detail: 'Last: ' + fmtHoursAgo(feedHrs),
      });
    } else {
      result.push({
        label: 'Feeding',
        emoji: '🍼',
        status: 'good',
        text: 'On track',
        detail: todayFeeds.length + ' today · last ' + fmtHoursAgo(feedHrs),
      });
    }

    // ─── Diaper status ───
    const diapers = logs.diaper || [];
    const todayDiapers = diapers.filter((e) => e.date === td);
    const lastDiaper = latestEntry(diapers);
    const lastDiaperMs = lastDiaper ? parseEntryTime(lastDiaper) : 0;
    const diaperHrs = lastDiaperMs ? hoursAgo(lastDiaperMs) : 999;
    const wetToday = todayDiapers.filter((e) => e.type === 'Wet' || e.type === 'Both').length;

    // Newborns need 6-8 wet diapers/day; older babies 4-6
    const wetTarget = age < 3 ? 6 : 4;

    if (diaperHrs >= 8 || (wetToday < Math.floor(wetTarget / 2) && new Date().getHours() >= 14)) {
      result.push({
        label: 'Diapers',
        emoji: '💧',
        status: 'action',
        text: wetToday < wetTarget ? 'Check hydration' : 'Check diaper',
        detail: wetToday + ' pee today · last ' + fmtHoursAgo(diaperHrs),
      });
    } else if (diaperHrs >= 5) {
      result.push({
        label: 'Diapers',
        emoji: '💧',
        status: 'watch',
        text: 'Check soon',
        detail: wetToday + ' pee today',
      });
    } else {
      result.push({
        label: 'Diapers',
        emoji: '💧',
        status: 'good',
        text: 'On track',
        detail: todayDiapers.length + ' changes · ' + wetToday + ' pee',
      });
    }

    // ─── Sleep status ───
    const sleeps = logs.sleep || [];
    // Find the chronologically latest sleep/wake entry (not array[0])
    let lastSleep: LogEntry | null = null;
    let lastSleepMs = 0;
    for (const e of sleeps) {
      if (e.type === 'Nap' || e.type === 'Night Sleep' || e.type === 'Wake Up') {
        const ms = parseEntryTime(e);
        if (ms > lastSleepMs) { lastSleepMs = ms; lastSleep = e; }
      }
    }
    const isSleeping =
      lastSleep && (lastSleep.type === 'Nap' || lastSleep.type === 'Night Sleep');

    let sleepMinsToday = 0;
    sleeps
      .filter((e) => e.date === td && e.mins)
      .forEach((e) => { sleepMinsToday += e.mins || 0; });
    const sleepHrs = sleepMinsToday / 60;

    // Age-based daily sleep targets (hours)
    const sleepTarget = age < 3 ? 16 : age < 6 ? 14 : age < 12 ? 13 : 12;

    if (isSleeping) {
      result.push({
        label: 'Sleep',
        emoji: '😴',
        status: 'good',
        text: 'Sleeping now',
        detail: lastSleep!.type + ' since ' + fmtTime(lastSleep!.time),
      });
    } else if (sleepHrs < sleepTarget * 0.3 && new Date().getHours() >= 16) {
      result.push({
        label: 'Sleep',
        emoji: '😴',
        status: 'watch',
        text: 'Needs more sleep',
        detail: Math.round(sleepHrs * 10) / 10 + 'h of ~' + sleepTarget + 'h target',
      });
    } else {
      result.push({
        label: 'Sleep',
        emoji: '😴',
        status: 'good',
        text: 'On track',
        detail: Math.round(sleepHrs * 10) / 10 + 'h today',
      });
    }

    return result;
  }, [logs, age, birth]);

  const statusColors = {
    good: { bg: C.okl, border: C.ok, text: C.ok, dot: C.ok },
    watch: { bg: C.wl, border: C.w, text: C.w, dot: C.w },
    action: { bg: C.pl, border: C.p, text: C.p, dot: C.p },
  };

  // Only show if at least one item needs attention
  const hasAttention = items.some((i) => i.status !== 'good');
  if (!hasAttention) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          gap: 6,
        }}
      >
        {items
          .filter((i) => i.status !== 'good')
          .map((item) => {
            const sc = statusColors[item.status];
            return (
              <div
                key={item.label}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: sc.bg,
                  borderRadius: 14,
                  borderLeft: '3px solid ' + sc.border,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    marginBottom: 2,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{item.emoji}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: sc.text,
                    }}
                  >
                    {item.text}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: C.tl, lineHeight: 1.3 }}>
                  {item.detail}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
