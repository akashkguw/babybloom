import { useEffect, useRef, useState } from 'react';
import { today, now, fmtTime } from '@/lib/utils/date';

export interface FeedTimer {
  type: string;
  startTime: number;
  startTimeStr: string;
}

export interface Logs {
  feed?: any[];
  diaper?: any[];
  sleep?: any[];
  [key: string]: any;
}

interface UseFeedingTimerReturn {
  feedTimer: FeedTimer | null;
  feedElapsed: number;
  startFeedTimer: (type: string) => void;
  stopFeedTimer: () => void;
  cancelFeedTimer: () => void;
  setFeedTimerApp: (timer: FeedTimer | null) => void;
}

export default function useFeedingTimer(logs: Logs, setLogs: (logs: Logs) => void, feedTimerApp: FeedTimer | null, setFeedTimerApp: (timer: FeedTimer | null) => void): UseFeedingTimerReturn {
  const feedTimer = feedTimerApp;
  const [feedElapsed, setFeedElapsed] = useState(feedTimer ? Math.floor((Date.now() - feedTimer.startTime) / 1000) : 0);
  const feedIntRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (feedTimer) {
      const diff = Math.floor((Date.now() - feedTimer.startTime) / 1000);
      if (diff > 14400) {
        setFeedTimerApp(null);
        // toast("Feed timer auto-reset (exceeded 4 hrs)");
        return;
      }
      setFeedElapsed(diff);
      feedIntRef.current = setInterval(() => {
        const el = Math.floor((Date.now() - feedTimer.startTime) / 1000);
        if (el > 14400) {
          clearInterval(feedIntRef.current!);
          setFeedTimerApp(null);
          // toast("Feed timer auto-reset (exceeded 4 hrs)");
          return;
        }
        setFeedElapsed(el);
      }, 1000);
      return () => {
        if (feedIntRef.current) clearInterval(feedIntRef.current);
      };
    } else {
      setFeedElapsed(0);
    }
  }, [feedTimer, setFeedTimerApp]);

  function startFeedTimer(type: string) {
    if (feedTimer) return;
    setFeedTimerApp({ type: type, startTime: Date.now(), startTimeStr: now() });
  }

  function getRecentFeed(type: string | null): any | null {
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

  function stopFeedTimer() {
    if (!feedTimer) return;
    const secs = Math.floor((Date.now() - feedTimer.startTime) / 1000);
    let minsInt = Math.round(secs / 60);
    if (minsInt < 1) minsInt = 1;
    const recent = getRecentFeed(null);
    if (recent) {
      // Show merge prompt - caller should handle this
      // setMergePrompt({mins:minsInt,type:feedTimer.type,recent:recent});
      setFeedTimerApp(null);
      return;
    }
    const entry = {
      date: today(),
      time: feedTimer.startTimeStr,
      id: Date.now(),
      type: feedTimer.type,
      amount: minsInt + ' min',
      mins: minsInt,
      notes: 'Timed',
    };
    const next = Object.assign({}, logs);
    next.feed = [entry].concat(logs.feed || []);
    setLogs(next);
    // toast(feedTimer.type + " — " + minsInt + " min logged");
    setFeedTimerApp(null);
  }

  function cancelFeedTimer() {
    setFeedTimerApp(null);
    // toast("Timer cancelled");
  }

  return {
    feedTimer,
    feedElapsed,
    startFeedTimer,
    stopFeedTimer,
    cancelFeedTimer,
    setFeedTimerApp,
  };
}
