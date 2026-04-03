import { useEffect, useRef, useState } from 'react';
import { today, now, fmtTime } from '@/lib/utils/date';
import { getRecentFeedWithinMinutes, msToLocalDate } from '@/features/feeding/timerUtils';

export interface FeedTimer {
  type: string;
  startTime: number;
  startTimeStr: string;
  startDateStr?: string;
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
  switchFeedSide: (newType: string) => void;
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
    setFeedTimerApp({ type: type, startTime: Date.now(), startTimeStr: now(), startDateStr: today() });
  }

  function getRecentFeed(type: string | null): any | null {
    const match = getRecentFeedWithinMinutes(logs.feed || [], type, 30);
    return match ? match.entry : null;
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
      date: feedTimer.startDateStr || msToLocalDate(feedTimer.startTime),
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

  function switchFeedSide(newType: string) {
    if (!feedTimer) return;
    // Save current side to log, then start new side with fresh timer
    const secs = Math.floor((Date.now() - feedTimer.startTime) / 1000);
    let minsInt = Math.round(secs / 60);
    if (minsInt < 1) minsInt = 1;
    const entry = {
      date: feedTimer.startDateStr || msToLocalDate(feedTimer.startTime),
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
    // Atomically switch to new side — no gap where feedTimer is null
    setFeedTimerApp({ type: newType, startTime: Date.now(), startTimeStr: now(), startDateStr: today() });
  }

  return {
    feedTimer,
    feedElapsed,
    startFeedTimer,
    stopFeedTimer,
    cancelFeedTimer,
    switchFeedSide,
    setFeedTimerApp,
  };
}
