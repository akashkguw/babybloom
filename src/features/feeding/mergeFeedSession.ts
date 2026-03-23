export interface FeedEntry {
  type: string;
  date: string;
  time: string;
  mins?: number;
  amount?: string;
  oz?: number;
  notes?: string;
  [key: string]: any;
}

export interface Logs {
  feed?: FeedEntry[];
  diaper?: any[];
  sleep?: any[];
  [key: string]: any;
}

export function getRecentFeed(logs: Logs, type: string | null): FeedEntry | null {
  const feeds = logs.feed || [];
  if (feeds.length === 0) return null;
  const last = feeds[0];
  if (!last.time || !last.date) return null;
  // Check if within 30 min
  const dp = last.date.split('-');
  const tp = last.time.split(':');
  const lastTime = new Date(parseInt(dp[0]), parseInt(dp[1]) - 1, parseInt(dp[2]), parseInt(tp[0]), parseInt(tp[1]));
  const diffMin = (Date.now() - lastTime.getTime()) / 60000;
  if (diffMin <= 30 && (!type || last.type === type)) return last;
  return null;
}

export function mergeIntoLastFeed(logs: Logs, extraMins: number, type: string): Logs {
  const feeds = logs.feed || [];
  if (feeds.length === 0) return logs;
  const last = feeds[0];
  const prevMins = last.mins || 0;
  const totalMins = prevMins + extraMins;
  const updated = Object.assign({}, last, {
    mins: totalMins,
    amount: totalMins + ' min',
    notes: ((last.notes || '') ? last.notes + '; ' : '') + '+ ' + extraMins + ' min' + (type && type !== last.type ? ' (' + type + ')' : ''),
  });
  const next = Object.assign({}, logs);
  next.feed = ([updated] as FeedEntry[]).concat(feeds.slice(1));
  return next;
}
