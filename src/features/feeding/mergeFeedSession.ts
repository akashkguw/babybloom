import { getRecentFeedWithinMinutes } from '@/features/feeding/timerUtils';

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
  const match = getRecentFeedWithinMinutes(logs.feed || [], type, 30);
  return match ? match.entry as FeedEntry : null;
}

export function mergeIntoLastFeed(logs: Logs, extraMins: number, type: string): Logs {
  const feeds = logs.feed || [];
  if (feeds.length === 0) return logs;
  const last = feeds[0];
  const prevMins = last.mins || 0;
  const totalMins = prevMins + extraMins;
  // When merging different breast sides, update type to the latest side
  // so risk indicators reflect the actual last breast used (#73)
  const isBreastSwitch = type && type !== last.type &&
    (type === 'Breast L' || type === 'Breast R') &&
    (last.type === 'Breast L' || last.type === 'Breast R');
  const updated = Object.assign({}, last, {
    mins: totalMins,
    amount: totalMins + ' min',
    ...(isBreastSwitch ? { type } : {}),
    notes: ((last.notes || '') ? last.notes + '; ' : '') + '+ ' + extraMins + ' min' + (type && type !== last.type ? ' (' + type + ')' : ''),
  });
  const next = Object.assign({}, logs);
  next.feed = ([updated] as FeedEntry[]).concat(feeds.slice(1));
  return next;
}
