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
    if (!f.date || !f.time) continue;
    const dp = f.date.split('-');
    const tp = f.time.split(':');
    const ms = new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0], +tp[1]).getTime();
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
