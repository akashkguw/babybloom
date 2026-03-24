import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card as Cd, Button as Btn, Input, Icon as Ic, ProgressCircle as PR } from '@/components/shared';
import { ds, dg } from '@/lib/db';
import VoiceButton from '@/features/voice/VoiceButton';
import { fmtVol, volLabel, mlToOz } from '@/lib/utils/volume';
import { today, now, fmtTime, daysAgo, autoSleepType, calcSleepMins } from '@/lib/utils/date';
import { C } from '@/lib/constants/colors';
import { MILESTONES } from '@/lib/constants/milestones';
import { VACCINES } from '@/lib/constants/vaccines';
import { toast } from '@/lib/utils/toast';
import { isValidBirthDate } from '@/lib/utils/validate';
import { getEncouragement } from '@/lib/constants/encouragements';
import useDynamicRedFlags from '@/features/insights/useDynamicRedFlags';

interface LogEntry {
  id: number;
  date: string;
  time: string;
  type: string;
  mins?: number;
  oz?: number;
  amount?: string;
  notes?: string;
}

interface FeedTimer {
  type: string;
  startTime: number;
  startTimeStr: string;
}

interface Logs {
  feed?: LogEntry[];
  diaper?: LogEntry[];
  sleep?: LogEntry[];
  [key: string]: LogEntry[] | undefined;
}

interface Reminders {
  enabled: boolean;
  feedInterval: number;
}

interface HomeTabProps {
  age: number;
  setTab: (tab: string, section?: string) => void;
  checked: Record<number, Record<string, boolean>>;
  birth: string | null;
  setBirth: (date: string) => void;
  logs: Logs;
  setLogs: (logs: Logs) => void;
  babyName: string;
  reminders?: Reminders;
  feedTimerApp: FeedTimer | null;
  setFeedTimerApp: (timer: FeedTimer | null) => void;
  volumeUnit: 'oz' | 'ml';
  vDone: { [key: string]: boolean };
  setVDone: (updater: (prev: { [key: string]: boolean }) => { [key: string]: boolean }) => void;
}

export default function HomeTab({
  age,
  setTab,
  checked,
  birth,
  setBirth,
  logs,
  setLogs,
  babyName,
  reminders,
  feedTimerApp,
  setFeedTimerApp,
  volumeUnit,
  vDone,
  setVDone,
}: HomeTabProps) {
  const [td2, setTd] = useState('');
  const [quickFeedType, setQuickFeedType] = useState<string | null>(null);
  const [quickFeedVal, setQuickFeedVal] = useState('');
  const [carouselIdx, setCarouselIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);
  // Merge prompt state kept for type compatibility but auto-merge is used instead
  const mergeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [feedElapsed, setFeedElapsed] = useState(
    feedTimerApp ? Math.floor((Date.now() - feedTimerApp.startTime) / 1000) : 0
  );
  const feedIntRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [flashBtn, setFlashBtn] = useState<string | null>(null);
  const [dismissedResumeId, setDismissedResumeId] = useState<number | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted dismissed resume ID on mount
  useEffect(() => {
    dg('dismissedResumeId').then((v) => { if (v != null) setDismissedResumeId(v); });
  }, []);

  const triggerFlash = useCallback((label: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashBtn(label);
    flashTimerRef.current = setTimeout(() => setFlashBtn(null), 500);
  }, []);

  // ═══ Quick-log warning colors — highlight important buttons not used recently ═══
  const quickLogWarnings = useMemo(() => {
    // Thresholds in hours: [warningStart, dangerStart]
    // After warningStart hours → amber tint; after dangerStart hours → red tint
    const thresholds: Record<string, { cat: string; types: string[]; warnH: number; dangerH: number; warnMsg: string; dangerMsg: string; neverMsg: string }> = {
      'Breast L': { cat: 'feed', types: ['Breast L'], warnH: 4, dangerH: 6, warnMsg: 'Left breast not fed in over {h}h', dangerMsg: 'Left breast not fed in over {h}h — feed soon', neverMsg: 'No left breast feeds logged yet' },
      'Breast R': { cat: 'feed', types: ['Breast R'], warnH: 4, dangerH: 6, warnMsg: 'Right breast not fed in over {h}h', dangerMsg: 'Right breast not fed in over {h}h — feed soon', neverMsg: 'No right breast feeds logged yet' },
      'Tummy':    { cat: 'tummy', types: ['Tummy Time'], warnH: 48, dangerH: 72, warnMsg: 'No tummy time in over {h}h', dangerMsg: 'No tummy time in {h}h — important for development', neverMsg: 'No tummy time logged yet' },
      'Wet':      { cat: 'diaper', types: ['Wet'], warnH: 6, dangerH: 10, warnMsg: 'No wet diaper in {h}h', dangerMsg: 'No wet diaper in {h}h — check hydration', neverMsg: 'No wet diapers logged yet' },
      'Dirty':    { cat: 'diaper', types: ['Dirty'], warnH: 24, dangerH: 48, warnMsg: 'No dirty diaper in {h}h', dangerMsg: 'No dirty diaper in {h}h — monitor closely', neverMsg: 'No dirty diapers logged yet' },
    };
    const warnings: Record<string, { level: 'warn' | 'danger'; reason: string } | null> = {};
    const nowMs = Date.now();
    for (const [label, cfg] of Object.entries(thresholds)) {
      const entries = logs[cfg.cat] || [];
      // Find most recent entry matching any of the types
      let lastMs = 0;
      for (const e of entries) {
        // Check type match directly, or via `sides` array for merged breast sessions
        const sides = (e as any).sides as string[] | undefined;
        const typeMatch = cfg.types.includes(e.type) || (sides && cfg.types.some((t) => sides.includes(t)));
        if (typeMatch && e.date && e.time) {
          const dp = e.date.split('-');
          const tp = e.time.split(':');
          const t = new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0], +tp[1]).getTime();
          if (t > lastMs) lastMs = t;
          break; // logs are sorted newest first
        }
      }
      if (lastMs === 0) {
        // No log ever — show danger if birth exists (baby needs care)
        warnings[label] = birth ? { level: 'danger', reason: cfg.neverMsg } : null;
      } else {
        const hoursAgo = (nowMs - lastMs) / 3600000;
        const hStr = hoursAgo < 1 ? Math.round(hoursAgo * 60) + 'm' : Math.round(hoursAgo) + '';
        if (hoursAgo >= cfg.dangerH) warnings[label] = { level: 'danger', reason: cfg.dangerMsg.replace('{h}', hStr) };
        else if (hoursAgo >= cfg.warnH) warnings[label] = { level: 'warn', reason: cfg.warnMsg.replace('{h}', hStr) };
        else warnings[label] = null;
      }
    }
    return warnings;
  }, [logs, birth]);

  // Long-press tooltip state for quick log buttons
  const [qlTooltip, setQlTooltip] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);
  const startLongPress = useCallback((reason: string) => {
    clearLongPress();
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setQlTooltip(reason);
      setTimeout(() => setQlTooltip(null), 2500);
    }, 400);
  }, [clearLongPress]);

  // ═══ Dynamic red flags — data-driven P0 alerts from recent logs ═══
  const dynamicRedFlags = useDynamicRedFlags(logs, age, birth);

  // ═══ Feed timer effect (must be before early return to keep hook count stable) ═══
  const feedTimer = feedTimerApp;
  useEffect(() => {
    if (feedTimer) {
      const diff = Math.floor((Date.now() - feedTimer.startTime) / 1000);
      if (diff > 14400) {
        setFeedTimerApp(null);
        toast('Feed timer auto-reset (exceeded 4 hrs)');
        return;
      }
      setFeedElapsed(diff);
      feedIntRef.current = setInterval(() => {
        const el = Math.floor((Date.now() - feedTimer.startTime) / 1000);
        if (el > 14400) {
          clearInterval(feedIntRef.current!);
          setFeedTimerApp(null);
          toast('Feed timer auto-reset (exceeded 4 hrs)');
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

  // mergeTimerRef cleanup
  useEffect(() => {
    return () => {
      if (mergeTimerRef.current) clearInterval(mergeTimerRef.current);
    };
  }, []);

  // ═══ Next feed reminder ═══
  const feedReminderText = useMemo(() => {
    if (!reminders || !reminders.enabled || !reminders.feedInterval) return null;
    const feeds = logs.feed || [];
    const lastFeed = feeds.length > 0 ? feeds[0] : null;
    if (!lastFeed || !lastFeed.time || !lastFeed.date) return { text: 'No feeds logged — time to feed?', overdue: true };
    const dp2 = lastFeed.date.split('-');
    const parts = lastFeed.time.split(':');
    const lastT = new Date(parseInt(dp2[0]), parseInt(dp2[1]) - 1, parseInt(dp2[2]), parseInt(parts[0]), parseInt(parts[1]), 0);
    const nextT = new Date(lastT.getTime() + reminders.feedInterval * 3600000);
    const now2 = new Date();
    if (now2 >= nextT) return { text: 'Feed overdue · last ' + fmtTime(lastFeed.time), overdue: true };
    const hrs = Math.floor((nextT.getTime() - now2.getTime()) / 3600000);
    const mins = Math.floor(((nextT.getTime() - now2.getTime()) % 3600000) / 60000);
    return { text: 'Next feed in ' + (hrs > 0 ? hrs + 'h ' : '') + mins + 'm', overdue: false };
  }, [reminders, logs.feed]);

  // Welcome screen if no birth date
  if (!birth) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* Decorative header */}
        <div style={{
          width: 88, height: 88, borderRadius: '50%', margin: '0 auto 20px',
          background: `linear-gradient(135deg, ${C.p}, ${C.s})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 24px ${C.p}44`,
        }}>
          <span style={{ fontSize: 42 }}>🍼</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.t, marginBottom: 6 }}>
          Welcome to BabyBloom
        </h1>
        <p style={{ color: C.tl, fontSize: 14, marginBottom: 32, lineHeight: 1.5 }}>
          Your baby care companion
        </p>

        <Cd style={{ maxWidth: 340, margin: '0 auto', padding: '28px 24px' }}>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: C.t }}>
            When was your baby born?
          </p>
          <p style={{ fontSize: 12, color: C.tl, marginBottom: 16 }}>
            Tap below to pick a date
          </p>

          {/* Large tappable date picker area */}
          <div
            onClick={() => {
              const inp = document.getElementById('bb-birth-input');
              if (inp) (inp as HTMLInputElement).showPicker?.();
              inp?.focus();
            }}
            style={{
              position: 'relative', padding: '16px 14px', borderRadius: 14,
              border: `2px solid ${td2 ? C.p : C.b}`,
              background: td2 ? C.pl + '33' : C.bg,
              cursor: 'pointer', transition: 'border 0.2s, background 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <span style={{ fontSize: 20 }}>📅</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: td2 ? C.t : C.tl }}>
              {td2 ? new Date(td2 + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Select birth date'}
            </span>
            <input
              id="bb-birth-input"
              type="date"
              value={td2}
              onChange={(e) => setTd(e.target.value)}
              style={{
                position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%',
                cursor: 'pointer',
              }}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <Btn
              label={td2 ? 'Get Started' : 'Select a date above'}
              onClick={() => {
                if (!td2 || !isValidBirthDate(td2)) { toast('Please enter a valid birth date (not in the future)'); return; }
                setBirth(td2);
              }}
              color={C.p}
              full={true}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <Btn
              label="Baby just born today"
              onClick={() => { setBirth(today()); }}
              outline={true}
              full={true}
            />
          </div>
        </Cd>
        <div style={{ marginTop: 24, fontSize: 11, color: C.tl, lineHeight: 1.5 }}>
          Data stored locally on your device
          <br />
          Based on AAP, CDC & WHO guidelines
        </div>
      </div>
    );
  }

  // ═══ Quick log helper ═══
  function quickLog(cat: string, entry: Partial<LogEntry>, btnLabel?: string) {
    if (btnLabel) triggerFlash(btnLabel);
    const e: LogEntry = Object.assign(
      { date: today(), time: now(), id: Date.now() },
      entry
    ) as LogEntry;

    // Auto-compute sleep duration for Wake Up
    if (cat === 'sleep' && e.type === 'Wake Up') {
      const sl = (logs.sleep || []).filter(
        (x) => x.type === 'Nap' || x.type === 'Night Sleep'
      );
      if (sl.length > 0 && sl[0].time && sl[0].date && e.time && e.date) {
        const df = calcSleepMins(sl[0].date, sl[0].time, e.date, e.time);
        if (df > 0) {
          const hrs2 = Math.floor(df / 60);
          const mins2 = df % 60;
          e.mins = df;
          e.amount = (hrs2 > 0 ? hrs2 + 'h ' : '') + (mins2 > 0 ? mins2 + 'm' : '0m');
        }
      }
    }

    const next = Object.assign({}, logs);
    next[cat] = [e].concat((logs[cat] || []) as LogEntry[]);
    setLogs(next);

    const msg =
      cat === 'sleep' && e.type === 'Wake Up' && e.mins
        ? e.type + ' logged (' + e.amount + ' sleep)'
        : e.type + ' logged';
    const encouragement = getEncouragement(cat, e.type);
    toast(msg + '\n' + encouragement);
  }


  function startFeedTimer(type: string) {
    if (feedTimer) return;
    setFeedTimerApp({
      type: type,
      startTime: Date.now(),
      startTimeStr: now(),
    });
  }

  // Check if last feed is recent & same type (for merge/continue)
  function getRecentFeed(type?: string | null): LogEntry | null {
    const feeds = logs.feed || [];
    if (feeds.length === 0) return null;
    const last = feeds[0];
    if (!last.time || !last.date) return null;

    // Check if within 30 min
    const dp = last.date.split('-');
    const tp = last.time.split(':');
    const lastTime = new Date(
      parseInt(dp[0]),
      parseInt(dp[1]) - 1,
      parseInt(dp[2]),
      parseInt(tp[0]),
      parseInt(tp[1])
    );
    const diffMin = (Date.now() - lastTime.getTime()) / 60000;
    if (diffMin <= 30 && (!type || last.type === type)) return last;
    return null;
  }

  function mergeIntoLastFeed(extraMins: number, type?: string) {
    const feeds = logs.feed || [];
    if (feeds.length === 0) return;
    const last = feeds[0];
    const prevMins = last.mins || 0;
    const totalMins = prevMins + extraMins;
    // When merging different breast sides, update type to the latest side
    // and track all sides used so warning colors stay correct for both
    const isBreastSwitch = type && type !== last.type &&
      (type === 'Breast L' || type === 'Breast R') &&
      (last.type === 'Breast L' || last.type === 'Breast R');
    // Build sides array — accumulate all breast sides used in this merged session
    const prevSides: string[] = (last as any).sides || (last.type === 'Breast L' || last.type === 'Breast R' ? [last.type] : []);
    const newSides = isBreastSwitch && type ? Array.from(new Set([...prevSides, type])) : prevSides;
    const updated = Object.assign({}, last, {
      mins: totalMins,
      amount: totalMins + ' min',
      ...(isBreastSwitch ? { type } : {}),
      ...(newSides.length > 0 ? { sides: newSides } : {}),
      notes:
        (last.notes ? last.notes + '; ' : '') +
        '+ ' +
        extraMins +
        ' min' +
        (type && type !== last.type ? ' (' + type + ')' : ''),
    });
    const next = Object.assign({}, logs);
    next.feed = ([updated] as LogEntry[]).concat(feeds.slice(1));
    setLogs(next);
    toast('Added ' + extraMins + ' min → total ' + totalMins + ' min');
  }

  function stopFeedTimer() {
    if (!feedTimer) return;
    const secs = Math.floor((Date.now() - feedTimer.startTime) / 1000);
    let minsInt = Math.round(secs / 60);
    if (minsInt < 1) minsInt = 1;

    const isTummy = feedTimer.type === 'Tummy Time';

    if (!isTummy) {
      const recent = getRecentFeed(null);
      if (recent) {
        // Auto-merge into previous feed silently
        mergeIntoLastFeed(minsInt, feedTimer.type);
        setFeedTimerApp(null);
        return;
      }
    }

    const entry: LogEntry = {
      date: today(),
      time: feedTimer.startTimeStr,
      id: Date.now(),
      type: feedTimer.type,
      amount: minsInt + ' min',
      mins: minsInt,
      notes: 'Timed',
    };
    const cat = isTummy ? 'tummy' : 'feed';
    const next = Object.assign({}, logs);
    next[cat] = [entry].concat((logs[cat] || []) as LogEntry[]);
    setLogs(next);
    const timerCat = isTummy ? 'tummy' : 'feed';
    const enc = getEncouragement(timerCat, feedTimer.type);
    toast(feedTimer.type + ' — ' + minsInt + ' min logged\n' + enc);
    setFeedTimerApp(null);
  }

  function cancelFeedTimer() {
    setFeedTimerApp(null);
    toast('Timer cancelled');
  }

  // ═══ Compute current milestone info ═══
  let curKey = 0;
  const keys = Object.keys(MILESTONES)
    .map(Number)
    .sort((a, b) => a - b);
  for (let i = 0; i < keys.length; i++) if (age >= keys[i]) curKey = keys[i];
  const ms = MILESTONES[curKey];
  const total = ms
    ? ([] as string[])
        .concat(ms.motor || [])
        .concat(ms.cog || [])
        .concat(ms.soc || [])
        .concat(ms.lang || []).length
    : 0;
  const done = checked[curKey]
    ? Object.values(checked[curKey]).filter(Boolean).length
    : 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // ═══ Compute today's stats ═══
  const td = today();
  const feedCt = (logs.feed || []).filter((x) => x.date === td).length;
  const diaperCt = (logs.diaper || []).filter((x) => x.date === td).length;
  const _sleepCt = (logs.sleep || []).filter((x) => x.date === td && x.type !== 'Wake Up').length;

  let sleepMinsToday = 0;
  (logs.sleep || [])
    .filter((x) => x.date === td && x.mins)
    .forEach((x) => {
      sleepMinsToday += x.mins || 0;
    });
  const sleepHrsToday = Math.round(sleepMinsToday / 6) / 10;

  let feedOzToday = 0;
  (logs.feed || [])
    .filter((x) => x.date === td && x.oz)
    .forEach((x) => {
      feedOzToday += x.oz || 0;
    });

  let _feedMinToday = 0;
  (logs.feed || [])
    .filter((x) => x.date === td && x.mins && !x.oz)
    .forEach((x) => {
      _feedMinToday += x.mins || 0;
    });

  // ═══ Last sleep status ═══
  const lastSleepEntry = (logs.sleep || []).find(
    (e) => e.type === 'Nap' || e.type === 'Night Sleep' || e.type === 'Wake Up'
  );
  let isSleeping =
    lastSleepEntry && (lastSleepEntry.type === 'Nap' || lastSleepEntry.type === 'Night Sleep');

  // Auto-expire: if sleep entry is from over 14 hours ago, assume baby woke up
  if (isSleeping && lastSleepEntry && lastSleepEntry.time && lastSleepEntry.date) {
    const spD = lastSleepEntry.date.split('-');
    const spT = lastSleepEntry.time.split(':');
    const sleepDate = new Date(
      parseInt(spD[0]),
      parseInt(spD[1]) - 1,
      parseInt(spD[2]),
      parseInt(spT[0]),
      parseInt(spT[1])
    );
    if (Date.now() - sleepDate.getTime() > 14 * 3600000) isSleeping = false;
  }

  // ═══ Weekly stats ═══
  let weekFeeds = 0,
    weekDiapers = 0;
  for (let i = 0; i < 7; i++) {
    const dk = daysAgo(i);
    weekFeeds += (logs.feed || []).filter((e) => e.date === dk).length;
    weekDiapers += (logs.diaper || []).filter((e) => e.date === dk).length;
  }

  // ═══ Next critical action (vaccine) ═══
  const ageToMonths: { [key: string]: number } = {
    Birth: 0, '1 Month': 1, '2 Months': 2, '4 Months': 4,
    '6 Months': 6, '9 Months': 9, '12 Months': 12, '15 Months': 15, '18 Months': 18,
  };

  const nextAction = (() => {
    // Find the first undone vaccine that is due (age-appropriate or overdue)
    for (let ai = 0; ai < VACCINES.length; ai++) {
      const group = VACCINES[ai];
      const dueAt = ageToMonths[group.age] ?? 0;
      // Only show vaccines that are due now or overdue (not far-future ones)
      if (dueAt > age + 1) continue;
      for (let vi = 0; vi < group.v.length; vi++) {
        const key = ai + '_' + vi;
        if (!vDone[key]) {
          return { ai, vi, vaccine: group.v[vi], ageLabel: group.age, key, overdue: dueAt < age };
        }
      }
    }
    return null;
  })();

  // ═══ Format age ═══
  const ageDays = Math.round(age * 30.44);
  const ageWeeks = Math.floor(ageDays / 7);
  const ageMonths = Math.floor(age);
  const ageStr =
    age < 1
      ? ageDays + ' days'
      : age < 2
        ? ageWeeks + ' weeks'
        : ageMonths + ' month' + (ageMonths !== 1 ? 's' : '');

  return (
    <div className="ca" style={{ padding: '16px 16px 120px' }}>
      {/* Hero — premium baby dashboard */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 24,
          marginBottom: 12,
          background: `linear-gradient(145deg, ${C.p}, ${C.s} 55%, ${C.pu} 100%)`,
          boxShadow: `0 8px 32px ${C.p}33, 0 2px 8px rgba(0,0,0,0.1)`,
        }}
      >
        {/* Decorative background elements */}
        <div style={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -25, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', top: 20, right: 60, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        {/* Main content */}
        <div style={{ position: 'relative', zIndex: 1, padding: '18px 20px 14px' }}>
          {/* Top row: greeting + milestone ring */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              {/* Greeting */}
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 500, letterSpacing: 0.3 }}>
                {(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; })()}
              </div>
              {/* Baby name */}
              <div style={{ color: 'white', fontSize: 22, fontWeight: 800, lineHeight: 1.2, marginTop: 2 }}>
                {babyName || 'Your baby'}
              </div>
              {/* Age badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                borderRadius: 20, padding: '4px 10px', marginTop: 6,
              }}>
                <span style={{ fontSize: 12 }}>{age < 3 ? '🍼' : age < 8 ? '👶' : age < 14 ? '🧒' : '🌟'}</span>
                <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>{ageStr}</span>
                {ms && <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>· {ms.l}</span>}
              </div>
            </div>

            {/* Milestone ring */}
            <div
              onClick={() => { setTab('miles', 'dev'); }}
              style={{
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: '10px 12px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <PR pct={pct} sz={42} sw={3} color="rgba(255,255,255,0.95)" trackColor="rgba(255,255,255,0.2)" />
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 9, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
                {pct}%<br />milestones
              </div>
            </div>
          </div>

          {/* Feed reminder */}
          {feedReminderText && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, marginTop: 10,
              background: feedReminderText.overdue ? 'rgba(255,100,100,0.2)' : 'rgba(255,255,255,0.1)',
              borderRadius: 10, padding: '5px 10px',
            }}>
              <span style={{ fontSize: 11 }}>{feedReminderText.overdue ? '⏰' : '🕐'}</span>
              <span style={{ color: feedReminderText.overdue ? 'rgba(255,210,210,0.95)' : 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 500 }}>
                {feedReminderText.text}
              </span>
            </div>
          )}

          {/* Today's quick stats */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <div onClick={() => { setTab('log', 'feed'); }} style={{
              flex: 1, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
              borderRadius: 12, padding: '8px 10px', textAlign: 'center', cursor: 'pointer',
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'white', lineHeight: 1 }}>{feedCt}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 500, marginTop: 2 }}>feeds</div>
              {feedOzToday > 0 && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{fmtVol(feedOzToday, volumeUnit)}</div>}
            </div>
            <div onClick={() => { setTab('log', 'diaper'); }} style={{
              flex: 1, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
              borderRadius: 12, padding: '8px 10px', textAlign: 'center', cursor: 'pointer',
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'white', lineHeight: 1 }}>{diaperCt}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 500, marginTop: 2 }}>diapers</div>
            </div>
            <div onClick={() => { setTab('log', 'sleep'); }} style={{
              flex: 1, background: isSleeping ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
              borderRadius: 12, padding: '8px 10px', textAlign: 'center', cursor: 'pointer',
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'white', lineHeight: 1 }}>
                {isSleeping ? '😴' : sleepHrsToday + 'h'}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 500, marginTop: 2 }}>
                {isSleeping ? 'sleeping' : 'sleep'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SmartStatus & PredictiveNudges moved into carousel */}

      {/* ═══ CAROUSEL: Red → Yellow → Green priority ═══ */}
      {(() => {
        const slides: { id: string; node: React.ReactNode; priority: number }[] = [];

        // ── Red flags (priority 0 — shown first) ──
        if (dynamicRedFlags.length > 0) {
          slides.push({
            id: 'redflag',
            priority: 0,
            node: (
              <div style={{ padding: '12px 14px', borderLeft: '4px solid ' + C.p, background: C.pl + '18', borderRadius: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.p, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  🚩 Needs attention
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {dynamicRedFlags.slice(0, 2).map((rf) => (
                    <div key={rf.id} style={{ fontSize: 11, color: C.t, lineHeight: 1.5, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <span style={{ flexShrink: 0 }}>{rf.emoji}</span>
                      <span style={{ fontWeight: rf.severity === 'critical' ? 700 : 400 }}>{rf.text}</span>
                    </div>
                  ))}
                </div>
                {dynamicRedFlags.length > 2 && (
                  <div style={{ fontSize: 10, color: C.tl, marginTop: 4 }}>
                    +{dynamicRedFlags.length - 2} more alert{dynamicRedFlags.length - 2 !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            ),
          });
        }

        // ── SmartStatus: feed/diaper/sleep cards (inline) ──
        {
          const allFeeds = logs.feed || [];
          const _todayFeeds = allFeeds.filter((e) => e.date === td);
          const lastFeed = allFeeds.length > 0 ? allFeeds[0] : null;
          const lastFeedMs = lastFeed && lastFeed.date && lastFeed.time
            ? (() => { const dp = lastFeed.date.split('-'); const tp = lastFeed.time.split(':'); return new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0], +tp[1]).getTime(); })()
            : 0;
          const feedHrs = lastFeedMs ? (Date.now() - lastFeedMs) / 3600000 : 999;
          const feedWarn = age < 3 ? 3 : age < 6 ? 3.5 : 4;
          const feedDanger = age < 3 ? 4 : age < 6 ? 5 : 6;
          const fmtAgo = (h: number) => h < 1 ? Math.round(h * 60) + 'm ago' : h < 24 ? Math.round(h * 10) / 10 + 'h ago' : Math.round(h / 24) + 'd ago';

          if (feedHrs >= feedDanger) {
            slides.push({ id: 'ss-feed', priority: 0, node: (
              <div style={{ padding: '10px 12px', background: C.pl, borderRadius: 14, borderLeft: '3px solid ' + C.p }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 14 }}>🍼</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.p }}>Feed now</span>
                </div>
                <div style={{ fontSize: 10, color: C.tl, lineHeight: 1.3 }}>{lastFeedMs ? 'Last: ' + fmtAgo(feedHrs) : 'No feeds logged'}</div>
              </div>
            )});
          } else if (feedHrs >= feedWarn) {
            slides.push({ id: 'ss-feed', priority: 1, node: (
              <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 14, borderLeft: '3px solid ' + C.w }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 14 }}>🍼</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.w }}>Feed soon</span>
                </div>
                <div style={{ fontSize: 10, color: C.tl, lineHeight: 1.3 }}>Last: {fmtAgo(feedHrs)}</div>
              </div>
            )});
          }

          const allDiapers = logs.diaper || [];
          const todayDiapers = allDiapers.filter((e) => e.date === td);
          const lastDiaper = allDiapers.length > 0 ? allDiapers[0] : null;
          const lastDiaperMs = lastDiaper && lastDiaper.date && lastDiaper.time
            ? (() => { const dp = lastDiaper.date.split('-'); const tp = lastDiaper.time.split(':'); return new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0], +tp[1]).getTime(); })()
            : 0;
          const diaperHrs = lastDiaperMs ? (Date.now() - lastDiaperMs) / 3600000 : 999;
          const wetToday = todayDiapers.filter((e) => e.type === 'Wet' || e.type === 'Both').length;
          const wetTarget = age < 3 ? 6 : 4;

          if (diaperHrs >= 8 || (wetToday < Math.floor(wetTarget / 2) && new Date().getHours() >= 14)) {
            slides.push({ id: 'ss-diaper', priority: 0, node: (
              <div style={{ padding: '10px 12px', background: C.pl, borderRadius: 14, borderLeft: '3px solid ' + C.p }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 14 }}>💧</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.p }}>{wetToday < wetTarget ? 'Check hydration' : 'Check diaper'}</span>
                </div>
                <div style={{ fontSize: 10, color: C.tl, lineHeight: 1.3 }}>{wetToday} wet today · last {fmtAgo(diaperHrs)}</div>
              </div>
            )});
          } else if (diaperHrs >= 5) {
            slides.push({ id: 'ss-diaper', priority: 1, node: (
              <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 14, borderLeft: '3px solid ' + C.w }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 14 }}>💧</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.w }}>Check soon</span>
                </div>
                <div style={{ fontSize: 10, color: C.tl, lineHeight: 1.3 }}>{wetToday} wet today</div>
              </div>
            )});
          }

          const sleepTarget = age < 3 ? 16 : age < 6 ? 14 : age < 12 ? 13 : 12;
          if (!isSleeping && sleepHrsToday < sleepTarget * 0.3 && new Date().getHours() >= 16) {
            slides.push({ id: 'ss-sleep', priority: 1, node: (
              <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 14, borderLeft: '3px solid ' + C.w }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 14 }}>😴</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.w }}>Needs more sleep</span>
                </div>
                <div style={{ fontSize: 10, color: C.tl, lineHeight: 1.3 }}>{sleepHrsToday}h of ~{sleepTarget}h target</div>
              </div>
            )});
          }
        }

        // ── Overdue vaccine (priority 0 if overdue, 2 if upcoming) ──
        if (nextAction) {
          slides.push({
            id: 'vaccine',
            priority: nextAction.overdue ? 0 : 2,
            node: (
              <div style={{ padding: '12px 14px', borderLeft: '4px solid ' + (nextAction.overdue ? C.p : C.bl), background: nextAction.overdue ? C.pl + '22' : C.bll + '44', borderRadius: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: nextAction.overdue ? C.p : C.bl, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                      {nextAction.overdue ? '⚠️ Overdue' : '💉 Don\'t miss'}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.t, lineHeight: 1.3 }}>
                      {nextAction.vaccine.n} — {nextAction.vaccine.d}
                    </div>
                    <div style={{ fontSize: 11, color: C.tl, marginTop: 2 }}>Due at {nextAction.ageLabel}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <div
                      onClick={() => {
                        setVDone((p) => {
                          const n = Object.assign({}, p);
                          n[nextAction.key] = true;
                          return n;
                        });
                        toast('Marked ' + nextAction.vaccine.n + ' as done!');
                      }}
                      style={{ padding: '6px 14px', borderRadius: 10, background: C.ok, color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >Done</div>
                    <div
                      onClick={() => { setTab('guide', 'vaccines'); }}
                      style={{ padding: '6px 10px', borderRadius: 10, background: C.cd, border: '1px solid ' + C.b, color: C.tl, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >View all</div>
                  </div>
                </div>
              </div>
            ),
          });
        }

        // ── Tip (priority 3 — green/informational, shown last) ──
        if (ms) {
          slides.push({
            id: 'tip',
            priority: 3,
            node: (
              <div style={{ padding: '12px 14px', borderLeft: '4px solid ' + C.a, background: C.cd, borderRadius: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.a, marginBottom: 3 }}>Tip for {ms.l}</div>
                <div style={{ fontSize: 12, color: C.t, lineHeight: 1.5 }}>{ms.tips}</div>
              </div>
            ),
          });
        }

        // Sort slides: red (0) → yellow (1) → blue (2) → green (3)
        slides.sort((a, b) => a.priority - b.priority);
        if (slides.length === 0) return null;
        const idx = carouselIdx >= slides.length ? 0 : carouselIdx;
        return (
          <div
            style={{ marginBottom: 12, overflow: 'hidden' }}
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              const diff = e.changedTouches[0].clientX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(diff) < 40) return;
              if (diff < 0 && idx < slides.length - 1) setCarouselIdx(idx + 1);
              else if (diff > 0 && idx > 0) setCarouselIdx(idx - 1);
            }}
          >
            {/* Show current slide with peek of next slide (#75) */}
            <div style={{ display: 'flex', gap: 8, transition: 'transform 0.3s ease', transform: slides.length > 1 ? `translateX(calc(-${idx} * (88% + 8px)))` : undefined }}>
              {slides.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    flex: '0 0 ' + (slides.length > 1 ? '88%' : '100%'),
                    opacity: i === idx ? 1 : 0.5,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  {s.node}
                </div>
              ))}
            </div>
            {slides.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                {slides.map((s, i) => (
                  <div
                    key={s.id}
                    onClick={() => setCarouselIdx(i)}
                    style={{
                      width: i === idx ? 16 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: i === idx ? C.p : C.b,
                      cursor: 'pointer',
                      transition: 'width 0.2s, background 0.2s',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ ACTIVE FEED TIMER — compact banner ═══ */}
      {feedTimer && (() => {
        const nudgeThresholds: { [key: string]: number } = {
          'Breast L': 35 * 60, 'Breast R': 35 * 60,
          'Tummy Time': 20 * 60,
        };
        const threshold = nudgeThresholds[feedTimer.type] || 45 * 60;
        const isLong = feedElapsed >= threshold;
        return (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 14px',
            background: isLong ? C.wl : C.al,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: isLong ? '1px solid ' + C.w : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 18 }}>{feedTimer.type === 'Tummy Time' ? '🧒' : '🤱'}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: isLong ? C.w : C.a }}>{feedTimer.type}</div>
              <div style={{ fontSize: 11, color: C.tl }}>since {fmtTime(feedTimer.startTimeStr)}</div>
              {isLong && (
                <div style={{ fontSize: 10, color: C.w, fontWeight: 600, marginTop: 2 }}>
                  Still going? Tap Done if finished
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: C.a,
              fontVariantNumeric: 'tabular-nums',
              minWidth: 52,
              textAlign: 'center',
            }}
          >
            {Math.floor(feedElapsed / 60)}:{String(feedElapsed % 60).padStart(2, '0')}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div
              onClick={stopFeedTimer}
              style={{
                padding: '6px 14px',
                borderRadius: 10,
                background: C.a,
                color: 'white',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Done
            </div>
            <div
              onClick={cancelFeedTimer}
              style={{
                padding: '6px 10px',
                borderRadius: 10,
                background: C.cd,
                border: '1px solid ' + C.b,
                color: C.tl,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </div>
          </div>
        </div>
        );
      })()}

      {/* ═══ CONTINUE / ADD TO PREVIOUS — shows when recent feed within 30 min, no timer running ═══ */}
      {!feedTimer &&
        (() => {
          const rf = getRecentFeed(null);
          if (!rf || rf.id === dismissedResumeId) return null;
          const elapsed = rf.mins || 0;
          return (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 14px',
                background: C.cd,
                borderRadius: 12,
                border: '1px solid ' + C.b,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>🍼</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.t }}>
                    {rf.type} • {elapsed > 0 ? elapsed + 'm' : fmtTime(rf.time)}
                  </div>
                  <div style={{ fontSize: 10, color: C.tl }}>
                    Tap to continue or add time
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <div
                  onClick={() => { setDismissedResumeId(rf.id); ds('dismissedResumeId', rf.id); }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    background: C.cd,
                    border: '1px solid ' + C.b,
                    color: C.tl,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </div>
                <div
                  onClick={() => startFeedTimer(rf.type)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    background: C.a,
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Resume
                </div>
              </div>
            </div>
          );
        })()}

      {/* ═══ QUICK LOG — uniform 4-column grid ═══ */}
      <Cd style={{ marginBottom: 12, padding: '14px 14px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t, marginBottom: 8 }}>Quick Log</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5 }}>
          {/* Row 1: feeding */}
          {[
            {
              e: '🤱',
              l: 'Breast L',
              fn: () => startFeedTimer('Breast L'),
              active: feedTimer && feedTimer.type === 'Breast L',
              dis: feedTimer && feedTimer.type !== 'Breast L',
            },
            {
              e: '🤱',
              l: 'Breast R',
              fn: () => startFeedTimer('Breast R'),
              active: feedTimer && feedTimer.type === 'Breast R',
              dis: feedTimer && feedTimer.type !== 'Breast R',
            },
            {
              e: '🍼',
              l: 'Formula',
              fn: () => {
                if (!feedTimer) {
                  setQuickFeedType('Formula');
                  setQuickFeedVal('');
                }
              },
              dis: !!feedTimer,
            },
            {
              e: '🍼',
              l: 'Breast Milk',
              fn: () => {
                if (!feedTimer) {
                  setQuickFeedType('Pumped Milk');
                  setQuickFeedVal('');
                }
              },
              dis: !!feedTimer,
            },
            /* Row 2: tummy + diaper + sleep */
            {
              e: '🧒',
              l: 'Tummy',
              fn: () => startFeedTimer('Tummy Time'),
              active: feedTimer && feedTimer.type === 'Tummy Time',
              dis: feedTimer && feedTimer.type !== 'Tummy Time',
            },
            { e: '💧', l: 'Wet', fn: () => quickLog('diaper', { type: 'Wet' }, 'Wet'), active: false, dis: false },
            { e: '💩', l: 'Dirty', fn: () => quickLog('diaper', { type: 'Dirty' }, 'Dirty'), active: false, dis: false },
            {
              e: isSleeping ? '⏰' : '😴',
              l: isSleeping ? 'Wake Up' : 'Sleep',
              fn: () => {
                const lbl = isSleeping ? 'Wake Up' : 'Sleep';
                if (isSleeping) {
                  quickLog('sleep', { type: 'Wake Up' }, lbl);
                } else {
                  quickLog('sleep', { type: autoSleepType() }, lbl);
                }
              },
              active: false,
              dis: false,
              highlight: isSleeping,
            },
          ].map((q: any) => {
            const warnInfo = quickLogWarnings[q.l] || null;
            const warn = warnInfo?.level || null;
            const warnBg = warn === 'danger' ? 'rgba(220,38,38,0.10)' : warn === 'warn' ? 'rgba(245,158,11,0.10)' : null;
            const warnBorder = warn === 'danger' ? 'rgba(220,38,38,0.4)' : warn === 'warn' ? 'rgba(245,158,11,0.4)' : null;
            const warnText = warn === 'danger' ? '#dc2626' : warn === 'warn' ? '#d97706' : null;
            return (
            <div
              key={q.l}
              className={'ql-btn' + (q.dis ? ' ql-dis' : '') + (flashBtn === q.l ? ' ql-flash' : '')}
              onClick={q.dis ? undefined : () => { if (longPressTriggered.current) { longPressTriggered.current = false; return; } q.fn(); }}
              onTouchStart={warnInfo ? () => startLongPress(warnInfo.reason) : undefined}
              onTouchEnd={warnInfo ? () => { clearLongPress(); } : undefined}
              onTouchCancel={warnInfo ? () => { clearLongPress(); longPressTriggered.current = false; } : undefined}
              onContextMenu={warnInfo ? (e: React.MouseEvent) => { e.preventDefault(); setQlTooltip(warnInfo.reason); setTimeout(() => setQlTooltip(null), 2500); } : undefined}
              style={{
                textAlign: 'center',
                padding: '8px 2px',
                borderRadius: 12,
                background: q.active ? C.al : q.highlight ? C.pul : warnBg || C.bg,
                border: '1px solid ' + (q.active ? C.a : q.highlight ? C.pu : warnBorder || C.b),
                cursor: q.dis ? 'default' : 'pointer',
                opacity: q.dis ? 0.35 : 1,
              }}
            >
              <div style={{ fontSize: 18 }}>{q.e}</div>
              <div style={{ fontSize: 9, color: q.active ? C.a : q.highlight ? C.pu : warnText || C.tl, marginTop: 2, fontWeight: 600 }}>
                {q.l}
              </div>
            </div>
            );
          })}
        </div>
        {/* Long-press tooltip */}
        {qlTooltip && (
          <div style={{
            marginTop: 8, padding: '8px 12px', borderRadius: 10,
            background: C.pl, border: '1px solid ' + C.p + '33',
            fontSize: 11, color: C.t, lineHeight: 1.4, textAlign: 'center',
            animation: 'fadeIn 0.15s ease',
          }}>
            {qlTooltip}
          </div>
        )}
      </Cd>

      {/* ═══ QUICK FEED — Formula/Pumped compact amount selector ═══ */}
      {quickFeedType && (() => {
        const isMl = volumeUnit === 'ml';
        const presets = isMl ? [30, 60, 90, 120, 150, 180] : [1, 2, 3, 4, 5, 6];
        const unit = volLabel(volumeUnit);
        const logAmount = (val: number) => {
          const ozVal = isMl ? mlToOz(val) : val;
          quickLog('feed', { type: quickFeedType, oz: ozVal, amount: val + ' ' + unit });
          setQuickFeedType(null);
          setQuickFeedVal('');
        };
        return (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) { setQuickFeedType(null); setQuickFeedVal(''); } }}
            style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}
          >
            <div style={{ width: '100%', background: C.cd, borderRadius: '22px 22px 0 0', padding: '16px 16px 28px' }}>
              {/* Drag handle */}
              <div style={{ width: 36, height: 4, borderRadius: 2, background: C.b, margin: '0 auto 12px' }} />

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🍼</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.t }}>{quickFeedType}</span>
                </div>
                <button onClick={() => { setQuickFeedType(null); setQuickFeedVal(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <Ic n="x" s={20} c={C.tl} />
                </button>
              </div>

              {/* Preset amount grid — single tap to log */}
              <div style={{ fontSize: 11, fontWeight: 600, color: C.tl, marginBottom: 8 }}>Quick pick ({unit})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                {presets.map((v) => (
                  <div
                    key={v}
                    onClick={() => logAmount(v)}
                    style={{
                      padding: '14px 8px', textAlign: 'center', cursor: 'pointer',
                      background: C.bg, borderRadius: 14, border: '1.5px solid ' + C.b,
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.t }}>{v}</div>
                    <div style={{ fontSize: 10, color: C.tl, marginTop: 2 }}>{unit}</div>
                  </div>
                ))}
              </div>

              {/* Custom amount row */}
              <div style={{ fontSize: 11, fontWeight: 600, color: C.tl, marginBottom: 6 }}>Custom</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <Input
                    type="number"
                    value={quickFeedVal}
                    onChange={setQuickFeedVal}
                    placeholder={isMl ? 'e.g. 120' : 'e.g. 4'}
                  />
                </div>
                <Btn
                  label={'Log ' + (quickFeedVal || '0') + ' ' + unit}
                  onClick={() => { logAmount(parseFloat(quickFeedVal) || 0); }}
                  color={C.a}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Sleep status banner */}
      {isSleeping && lastSleepEntry && (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 14px',
            background: C.pul,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 13, color: C.pu }}>
            <span style={{ fontWeight: 700 }}>Sleeping</span>
            <span style={{ marginLeft: 6, fontSize: 11, color: C.tl }}>
              {lastSleepEntry.type} since {fmtTime(lastSleepEntry.time)}
            </span>
          </div>
          <div
            onClick={() => {
              quickLog('sleep', { type: 'Wake Up' });
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              background: C.pu,
              color: 'white',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Wake Up
          </div>
        </div>
      )}

      {/* Quick Actions — with stats */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          { e: '🎨', l: 'Activities', t: 'guide', s: 'activities', stat: '' },
          { e: '🛡️', l: 'Safety', t: 'safety', s: 'tips', stat: '' },
          { e: '📋', l: 'Report', t: '_report', s: '', stat: '' },
          { e: '📊', l: 'All Stats', t: 'log', s: 'stats', stat: `wk ${weekFeeds}F · ${weekDiapers}D` },
        ].map((q: any) => (
          <div
            key={q.l}
            onClick={() => { setTab(q.t, q.s); }}
            style={{
              flex: 1,
              padding: '10px 6px 8px',
              textAlign: 'center',
              cursor: 'pointer',
              background: C.cd,
              borderRadius: 14,
              border: '1px solid ' + C.b,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span style={{ fontSize: 18 }}>{q.e}</span>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.t, lineHeight: 1.2 }}>{q.l}</div>
            {q.stat && <div style={{ fontSize: 8, color: C.tl, lineHeight: 1.1 }}>{q.stat}</div>}
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', padding: 8, color: C.tl, fontSize: 10 }}>
        Based on AAP, CDC & WHO guidelines
        <br />
        Data stored locally • Not medical advice
      </div>

      {/* ═══ VOICE LOG BUTTON ═══ */}
      <VoiceButton quickLog={quickLog} babyName={babyName} />

    </div>
  );
}
