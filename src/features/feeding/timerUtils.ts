export interface FeedLikeEntry {
  date?: string;
  time?: string;
  type?: string;
  [key: string]: any;
}

export interface FeedTimerLike {
  type: string;
  startTime: number;
  startTimeStr: string;
  startDateStr?: string;
}

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000; // tolerate small clock drift
const MAX_FEED_DURATION_MIN = 4 * 60; // sanity cap (timer auto-resets at 4h)

function pad2(v: number): string {
  return String(v).padStart(2, '0');
}

export function msToLocalDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function msToLocalTime(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function normalizeFeedTimer(raw: any): FeedTimerLike | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.type || typeof raw.type !== 'string') return null;
  if (typeof raw.startTime !== 'number' || !Number.isFinite(raw.startTime)) return null;

  return {
    type: raw.type,
    startTime: raw.startTime,
    startTimeStr: typeof raw.startTimeStr === 'string' && raw.startTimeStr ? raw.startTimeStr : msToLocalTime(raw.startTime),
    startDateStr: typeof raw.startDateStr === 'string' && raw.startDateStr ? raw.startDateStr : msToLocalDate(raw.startTime),
  };
}

export function entryTimestampMs(entry: Pick<FeedLikeEntry, 'date' | 'time'>): number {
  if (!entry.date || !entry.time) return 0;
  const dp = entry.date.split('-').map(Number);
  const tp = entry.time.split(':').map(Number);
  if (dp.length < 3 || tp.length < 2 || dp.some(Number.isNaN) || tp.some(Number.isNaN)) return 0;
  return new Date(dp[0], dp[1] - 1, dp[2], tp[0], tp[1]).getTime();
}

/**
 * For timed feeds, treat completion time as start + mins.
 * Falls back to start timestamp for non-duration entries.
 */
export function entryCompletionTimestampMs(entry: FeedLikeEntry): number {
  const startMs = entryTimestampMs(entry);
  if (!startMs) return 0;
  const minsRaw = typeof entry.mins === 'number' ? entry.mins : Number(entry.mins);
  if (!Number.isFinite(minsRaw) || minsRaw <= 0 || minsRaw > MAX_FEED_DURATION_MIN) {
    return startMs;
  }
  return startMs + Math.round(minsRaw * 60_000);
}

/**
 * Find the most recent feed by parsed date/time.
 * Prefers entries not in the future (within 5 min skew tolerance).
 */
export function findMostRecentFeed(
  feeds: FeedLikeEntry[],
  nowMs: number = Date.now(),
  useCompletionTime: boolean = false,
): { entry: FeedLikeEntry; index: number; timestampMs: number } | null {
  if (!Array.isArray(feeds) || feeds.length === 0) return null;

  let bestPast: { entry: FeedLikeEntry; index: number; timestampMs: number } | null = null;
  let bestAny: { entry: FeedLikeEntry; index: number; timestampMs: number } | null = null;

  for (let i = 0; i < feeds.length; i++) {
    const entry = feeds[i];
    const ts = useCompletionTime ? entryCompletionTimestampMs(entry) : entryTimestampMs(entry);
    if (!ts) continue;

    if (!bestAny || ts > bestAny.timestampMs) {
      bestAny = { entry, index: i, timestampMs: ts };
    }

    if (ts <= nowMs + MAX_FUTURE_SKEW_MS && (!bestPast || ts > bestPast.timestampMs)) {
      bestPast = { entry, index: i, timestampMs: ts };
    }
  }

  return bestPast || bestAny;
}

/**
 * Find the most recent feed within a time window and matching type constraints.
 * Allows Breast L/R cross-merge compatibility.
 */
export function getRecentFeedWithinMinutes(
  feeds: FeedLikeEntry[],
  type: string | null,
  windowMinutes: number = 30,
  nowMs: number = Date.now(),
  useCompletionTime: boolean = false,
): { entry: FeedLikeEntry; index: number; timestampMs: number } | null {
  const recent = findMostRecentFeed(feeds, nowMs, useCompletionTime);
  if (!recent) return null;

  const diffMin = (nowMs - recent.timestampMs) / 60000;
  if (diffMin < -5 || diffMin > windowMinutes) return null;

  if (!type) return recent;
  if (recent.entry.type === type) return recent;

  const isMergeableBreast =
    (type === 'Breast L' || type === 'Breast R') &&
    (recent.entry.type === 'Breast L' || recent.entry.type === 'Breast R');
  if (isMergeableBreast) return recent;

  return null;
}
