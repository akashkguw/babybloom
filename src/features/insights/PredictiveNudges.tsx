/**
 * Predictive Nudges
 * Learns the baby's routine from logged data and predicts
 * the next feed/sleep/diaper window. Shows a gentle nudge
 * before the predicted time so parents can prepare.
 */
import { useState, useEffect, useMemo } from 'react';
import { C } from '@/lib/constants/colors';
import { today, fmtTime } from '@/lib/utils/date';

interface LogEntry {
  id: number;
  date: string;
  time: string;
  type: string;
  mins?: number;
  oz?: number;
}

interface Logs {
  feed?: LogEntry[];
  diaper?: LogEntry[];
  sleep?: LogEntry[];
  [key: string]: LogEntry[] | undefined;
}

interface NudgeItem {
  id: string;
  emoji: string;
  label: string;
  message: string;
  urgency: 'upcoming' | 'now' | 'past';
  minutesUntil: number;
}

interface PredictiveNudgesProps {
  logs: Logs;
  age: number;
}

function parseTime(date: string, time: string): number {
  const dp = date.split('-');
  const tp = time.split(':');
  return new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0], +tp[1]).getTime();
}

/**
 * Compute average interval (in ms) between recent entries of a category.
 * Uses the last 7 days of data to find the pattern.
 */
function avgInterval(entries: LogEntry[], types?: string[]): number | null {
  const recent = entries
    .filter((e) => {
      if (!e.date || !e.time) return false;
      if (types && !types.includes(e.type)) return false;
      const ms = parseTime(e.date, e.time);
      return Date.now() - ms < 7 * 86400000; // last 7 days
    })
    .sort((a, b) => parseTime(b.date, b.time) - parseTime(a.date, a.time));

  if (recent.length < 3) return null; // not enough data

  const intervals: number[] = [];
  for (let i = 0; i < recent.length - 1 && i < 10; i++) {
    const diff = parseTime(recent[i].date, recent[i].time) - parseTime(recent[i + 1].date, recent[i + 1].time);
    // Only count intervals between 20min and 12h (filter out noise)
    if (diff > 20 * 60000 && diff < 12 * 3600000) {
      intervals.push(diff);
    }
  }

  if (intervals.length < 2) return null;

  // Trim outliers: remove top and bottom 20%
  intervals.sort((a, b) => a - b);
  const trim = Math.max(1, Math.floor(intervals.length * 0.2));
  const trimmed = intervals.slice(trim, intervals.length - trim);
  if (trimmed.length === 0) return intervals[Math.floor(intervals.length / 2)];

  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

function fmtMinutes(mins: number): string {
  const absMins = Math.abs(Math.round(mins));
  if (absMins < 60) return absMins + 'm';
  const h = Math.floor(absMins / 60);
  const m = absMins % 60;
  return h + 'h' + (m > 0 ? ' ' + m + 'm' : '');
}

export default function PredictiveNudges({ logs, age }: PredictiveNudgesProps) {
  const [nowMs, setNowMs] = useState(Date.now());

  // Refresh every minute to keep nudges current
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(iv);
  }, []);

  const nudges = useMemo<NudgeItem[]>(() => {
    const items: NudgeItem[] = [];
    const LEAD_TIME = 15 * 60000; // show nudge 15min before predicted time

    // ─── Feed prediction ───
    const feeds = logs.feed || [];
    const feedInterval = avgInterval(feeds);
    if (feedInterval && feeds.length > 0) {
      const lastFeedMs = parseTime(feeds[0].date, feeds[0].time);
      const predictedNext = lastFeedMs + feedInterval;
      const minsUntil = (predictedNext - nowMs) / 60000;
      const avgMins = Math.round(feedInterval / 60000);

      if (minsUntil < -30) {
        // More than 30 min past predicted — strong nudge
        items.push({
          id: 'feed',
          emoji: '🍼',
          label: 'Feed window',
          message: 'Usually feeds every ~' + fmtMinutes(avgMins) + ' · ' + fmtMinutes(-minsUntil) + ' past window',
          urgency: 'past',
          minutesUntil: minsUntil,
        });
      } else if (minsUntil <= LEAD_TIME / 60000) {
        items.push({
          id: 'feed',
          emoji: '🍼',
          label: 'Feed window opening',
          message: minsUntil <= 0
            ? 'About now based on ' + babyName() + '\'s pattern'
            : 'In ~' + fmtMinutes(minsUntil) + ' based on pattern',
          urgency: minsUntil <= 0 ? 'now' : 'upcoming',
          minutesUntil: minsUntil,
        });
      }
    }

    // ─── Sleep prediction ───
    const sleeps = (logs.sleep || []).filter(
      (e) => e.type === 'Nap' || e.type === 'Night Sleep'
    );
    const sleepInterval = avgInterval(logs.sleep || [], ['Nap', 'Night Sleep']);
    if (sleepInterval && sleeps.length > 0) {
      const lastSleepMs = parseTime(sleeps[0].date, sleeps[0].time);
      // Check if currently sleeping
      const lastSleepEntry = (logs.sleep || []).find(
        (e) => e.type === 'Nap' || e.type === 'Night Sleep' || e.type === 'Wake Up'
      );
      const isSleeping = lastSleepEntry && lastSleepEntry.type !== 'Wake Up';

      if (!isSleeping) {
        // Use wake time if available, otherwise sleep time
        const wakeUps = (logs.sleep || []).filter((e) => e.type === 'Wake Up');
        const lastWakeMs = wakeUps.length > 0 ? parseTime(wakeUps[0].date, wakeUps[0].time) : lastSleepMs;
        const awakeInterval = avgInterval(logs.sleep || [], ['Wake Up']);
        const baseMs = awakeInterval ? lastWakeMs : lastSleepMs;
        const interval = awakeInterval || sleepInterval;

        const predictedNext = baseMs + interval;
        const minsUntil = (predictedNext - nowMs) / 60000;

        if (minsUntil <= LEAD_TIME / 60000 && minsUntil > -60) {
          items.push({
            id: 'sleep',
            emoji: '😴',
            label: minsUntil <= 0 ? 'Nap time' : 'Nap window opening',
            message: minsUntil <= 0
              ? 'Usual nap time based on pattern'
              : 'In ~' + fmtMinutes(minsUntil),
            urgency: minsUntil <= 0 ? 'now' : 'upcoming',
            minutesUntil: minsUntil,
          });
        }
      }
    }

    // ─── Diaper prediction ───
    const diapers = logs.diaper || [];
    const diaperInterval = avgInterval(diapers);
    if (diaperInterval && diapers.length > 0) {
      const lastDiaperMs = parseTime(diapers[0].date, diapers[0].time);
      const predictedNext = lastDiaperMs + diaperInterval;
      const minsUntil = (predictedNext - nowMs) / 60000;

      if (minsUntil <= 5 && minsUntil > -120) {
        items.push({
          id: 'diaper',
          emoji: '💧',
          label: 'Diaper check',
          message: 'Usually due about now',
          urgency: minsUntil <= 0 ? 'now' : 'upcoming',
          minutesUntil: minsUntil,
        });
      }
    }

    // Sort: past > now > upcoming
    const urgencyOrder = { past: 0, now: 1, upcoming: 2 };
    items.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return items;
  }, [logs, age, nowMs]);

  if (nudges.length === 0) return null;

  const urgencyStyles = {
    upcoming: { bg: C.bll, border: C.bl, accent: C.bl },
    now: { bg: C.wl, border: C.w, accent: C.w },
    past: { bg: C.pl, border: C.p, accent: C.p },
  };

  return (
    <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {nudges.map((nudge) => {
        const s = urgencyStyles[nudge.urgency];
        return (
          <div
            key={nudge.id}
            style={{
              padding: '10px 14px',
              background: s.bg,
              borderRadius: 14,
              borderLeft: '3px solid ' + s.border,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18 }}>{nudge.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.accent }}>
                {nudge.label}
              </div>
              <div style={{ fontSize: 11, color: C.tl, lineHeight: 1.3 }}>
                {nudge.message}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Helper — not using babyName prop to keep component simple
function babyName(): string {
  return 'baby';
}
