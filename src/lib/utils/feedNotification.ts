/**
 * Feed notification dedup logic.
 *
 * Determines whether a feed-due notification should fire, preventing
 * duplicate notifications for the same overdue feed — both within a
 * single session and across app restarts.
 */

export interface FeedEntry {
  date?: string;   // "YYYY-MM-DD"
  time?: string;   // "HH:MM"
  mins?: number | string;
  [key: string]: any;
}

export interface FeedNotifCheck {
  /** Whether to send the notification */
  shouldNotify: boolean;
  /** The notification body text (only set when shouldNotify is true) */
  body?: string;
  /** The feed key used for dedup (date_time of the last feed) */
  feedKey?: string;
}

const MAX_FEED_DURATION_MIN = 4 * 60; // sanity cap

function feedEffectiveTimestampMs(feed: FeedEntry): number {
  if (!feed.date || !feed.time) return 0;
  const dp = feed.date.split('-').map(Number);
  const tp = feed.time.split(':').map(Number);
  if (dp.length < 3 || tp.length < 2 || dp.some(Number.isNaN) || tp.some(Number.isNaN)) return 0;
  const startMs = new Date(dp[0], dp[1] - 1, dp[2], tp[0], tp[1]).getTime();
  const minsRaw = typeof feed.mins === 'number' ? feed.mins : Number(feed.mins);
  if (!Number.isFinite(minsRaw) || minsRaw <= 0 || minsRaw > MAX_FEED_DURATION_MIN) return startMs;
  return startMs + Math.round(minsRaw * 60_000);
}

/**
 * Compute whether a feed-due notification should fire.
 *
 * @param feeds          Array of feed entries, newest first
 * @param intervalHours  How many hours between feeds before reminding
 * @param lastNotifiedKey The feed key that was last notified (for dedup)
 * @param nowMs          Current time in ms (default: Date.now())
 * @returns              FeedNotifCheck with shouldNotify, body, feedKey
 */
export function checkFeedNotification(
  feeds: FeedEntry[],
  intervalHours: number,
  lastNotifiedKey: string | null,
  nowMs: number = Date.now()
): FeedNotifCheck {
  if (!feeds || feeds.length === 0) {
    return { shouldNotify: false };
  }

  // Find chronologically most recent feed (not just array[0])
  // to avoid false alerts when logging feeds for past dates
  let lastFeed: FeedEntry | null = null;
  let lastTimeMs = 0;
  for (const f of feeds) {
    const ms = feedEffectiveTimestampMs(f);
    if (ms > lastTimeMs) { lastTimeMs = ms; lastFeed = f; }
  }
  if (!lastFeed || !lastFeed.date || !lastFeed.time) {
    return { shouldNotify: false };
  }

  const feedKey = lastFeed.date + '_' + lastFeed.time;
  const diffHours = (nowMs - lastTimeMs) / 3600000;

  if (diffHours >= intervalHours && feedKey !== lastNotifiedKey) {
    const body = `Time for a feeding! Last feed was ${Math.round(diffHours * 10) / 10} hours ago.`;
    return { shouldNotify: true, body, feedKey };
  }

  return { shouldNotify: false, feedKey };
}
