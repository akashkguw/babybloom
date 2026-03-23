import { useState, useEffect, useRef } from 'react';
import { Card as Cd, SectionHeader as SH, Button as Btn, Pill, Input, Icon as Ic, ProgressCircle as PR } from '@/components/shared';
import VoiceButton from '@/features/voice/VoiceButton';
import { fmtVol, volLabel, mlToOz, ozToMl } from '@/lib/utils/volume';
import { today, now, fmtTime, fmtDate, daysAgo, autoSleepType } from '@/lib/utils/date';
import { C } from '@/lib/constants/colors';
import { MILESTONES } from '@/lib/constants/milestones';
import { VACCINES } from '@/lib/constants/vaccines';
import { toast } from '@/lib/utils/toast';
import { getEncouragement } from '@/lib/constants/encouragements';

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
  // Merge prompt state kept for type compatibility but auto-merge is used instead
  const mergeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [feedElapsed, setFeedElapsed] = useState(
    feedTimerApp ? Math.floor((Date.now() - feedTimerApp.startTime) / 1000) : 0
  );
  const feedIntRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Welcome screen if no birth date
  if (!birth) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🍼</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.t, marginBottom: 8 }}>
          Welcome to BabyBloom
        </h1>
        <p
          style={{
            color: C.tl,
            fontSize: 15,
            marginBottom: 40,
            lineHeight: 1.5,
          }}
        >
          Your complete baby care companion
          <br />
          powered by AAP, CDC & WHO guidelines
        </p>
        <Cd style={{ maxWidth: 340, margin: '0 auto', padding: 24 }}>
          <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>
            When was your baby born?
          </p>
          <Input type="date" value={td2} onChange={setTd} />
          <div style={{ marginTop: 16 }}>
            <Btn
              label="Get Started"
              onClick={() => {
                if (td2) setBirth(td2);
              }}
              color={C.p}
              full={true}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <Btn
              label="Skip — just born"
              onClick={() => {
                setBirth(today());
              }}
              outline={true}
              full={true}
            />
          </div>
        </Cd>
        <div style={{ marginTop: 20, fontSize: 12, color: C.tl }}>
          Data stored locally on your device
        </div>
      </div>
    );
  }

  // ═══ Quick log helper ═══
  function quickLog(cat: string, entry: Partial<LogEntry>) {
    const e: LogEntry = Object.assign(
      { date: today(), time: now(), id: Date.now() },
      entry
    ) as LogEntry;

    // Auto-compute sleep duration for Wake Up
    if (cat === 'sleep' && e.type === 'Wake Up') {
      const sl = (logs.sleep || []).filter(
        (x) => x.type === 'Nap' || x.type === 'Night Sleep'
      );
      if (sl.length > 0 && sl[0].time && e.time) {
        const wP = e.time.split(':');
        const sP = sl[0].time.split(':');
        const wM = parseInt(wP[0]) * 60 + parseInt(wP[1]);
        const sM = parseInt(sP[0]) * 60 + parseInt(sP[1]);
        let df = wM - sM;
        if (df < 0) df += 1440;
        if (df > 0 && df < 1440) {
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

  // ═══ Inline feed timer (state lives in App so it survives tab switches) ═══
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
    const updated = Object.assign({}, last, {
      mins: totalMins,
      amount: totalMins + ' min',
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
    const cat = isTummy ? 'sleep' : 'feed';
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
  const sleepCt = (logs.sleep || []).filter((x) => x.date === td && x.type !== 'Wake Up' && x.type !== 'Tummy Time').length;

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

  let feedMinToday = 0;
  (logs.feed || [])
    .filter((x) => x.date === td && x.mins && !x.oz)
    .forEach((x) => {
      feedMinToday += x.mins || 0;
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
    weekDiapers = 0,
    weekSleeps = 0,
    prevWeekFeeds = 0,
    prevWeekDiapers = 0;
  for (let i = 0; i < 7; i++) {
    const dk = daysAgo(i);
    weekFeeds += (logs.feed || []).filter((e) => e.date === dk).length;
    weekDiapers += (logs.diaper || []).filter((e) => e.date === dk).length;
    weekSleeps += (logs.sleep || []).filter((e) => e.date === dk && e.type !== 'Wake Up' && e.type !== 'Tummy Time').length;
  }
  for (let i = 7; i < 14; i++) {
    const dk = daysAgo(i);
    prevWeekFeeds += (logs.feed || []).filter((e) => e.date === dk).length;
    prevWeekDiapers += (logs.diaper || []).filter((e) => e.date === dk).length;
  }
  const feedTrend = weekFeeds > prevWeekFeeds ? '↑' : weekFeeds < prevWeekFeeds ? '↓' : '→';
  const diaperTrend =
    weekDiapers > prevWeekDiapers ? '↑' : weekDiapers < prevWeekDiapers ? '↓' : '→';

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
      {/* Hero — age + milestone + today's stats */}
      <Cd
        style={{
          background: `linear-gradient(135deg,${C.p},${C.s})`,
          border: 'none',
          marginBottom: 12,
          padding: '14px 20px 12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>{age < 3 ? '🍼' : age < 8 ? '👶' : age < 14 ? '🧒' : '🌟'}</span>
              <span>Your baby is</span>
            </div>
            <div style={{ color: 'white', fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
              {ageStr}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 }}>
              {ms ? 'Stage: ' + ms.l : ''}
            </div>
          </div>
          <div
            onClick={() => { setTab('miles', 'dev'); }}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
          >
            <PR pct={pct} sz={44} sw={3} color="rgba(255,255,255,0.9)" trackColor="rgba(255,255,255,0.25)" />
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: 600 }}>
              {pct}% milestones
            </div>
          </div>
        </div>
        {/* Stats link */}
        <div
          onClick={() => { setTab('log', 'stats'); }}
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>View Stats</span>
          <Ic n="chevron-right" s={14} c="rgba(255,255,255,0.7)" />
        </div>
      </Cd>

      {/* ═══ NEXT CRITICAL ACTION ═══ */}
      {nextAction && (
        <Cd
          style={{
            marginBottom: 12,
            padding: '12px 14px',
            borderLeft: '4px solid ' + (nextAction.overdue ? C.p : C.bl),
            background: nextAction.overdue ? C.pl + '22' : C.bll + '44',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: nextAction.overdue ? C.p : C.bl, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                {nextAction.overdue ? '⚠️ Overdue' : '💉 Don\'t miss'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.t, lineHeight: 1.3 }}>
                {nextAction.vaccine.n} — {nextAction.vaccine.d}
              </div>
              <div style={{ fontSize: 11, color: C.tl, marginTop: 2 }}>
                Due at {nextAction.ageLabel}
              </div>
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
                style={{
                  padding: '6px 14px',
                  borderRadius: 10,
                  background: C.ok,
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Done
              </div>
              <div
                onClick={() => { setTab('guide', 'vaccines'); }}
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
                View all
              </div>
            </div>
          </div>
        </Cd>
      )}

      {/* ═══ ACTIVE FEED TIMER — compact banner ═══ */}
      {feedTimer && (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 14px',
            background: C.al,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 18 }}>{feedTimer.type === 'Tummy Time' ? '🧒' : '🤱'}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.a }}>{feedTimer.type}</div>
              <div style={{ fontSize: 11, color: C.tl }}>since {fmtTime(feedTimer.startTimeStr)}</div>
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
      )}

      {/* ═══ CONTINUE / ADD TO PREVIOUS — shows when recent feed within 30 min, no timer running ═══ */}
      {!feedTimer &&
        (() => {
          const rf = getRecentFeed(null);
          if (!rf) return null;
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
            { e: '💧', l: 'Wet', fn: () => quickLog('diaper', { type: 'Wet' }), active: false, dis: false },
            { e: '💩', l: 'Dirty', fn: () => quickLog('diaper', { type: 'Dirty' }), active: false, dis: false },
            {
              e: isSleeping ? '⏰' : '😴',
              l: isSleeping ? 'Wake Up' : 'Sleep',
              fn: () => {
                if (isSleeping) {
                  quickLog('sleep', { type: 'Wake Up' });
                } else {
                  quickLog('sleep', { type: autoSleepType() });
                }
              },
              active: false,
              dis: false,
              highlight: isSleeping,
            },
          ].map((q: any) => (
            <div
              key={q.l}
              onClick={q.dis ? null : q.fn}
              style={{
                textAlign: 'center',
                padding: '8px 2px',
                borderRadius: 12,
                background: q.active ? C.al : q.highlight ? C.pul : C.bg,
                border: '1px solid ' + (q.active ? C.a : q.highlight ? C.pu : C.b),
                cursor: q.dis ? 'default' : 'pointer',
                opacity: q.dis ? 0.35 : 1,
              }}
            >
              <div style={{ fontSize: 18 }}>{q.e}</div>
              <div style={{ fontSize: 9, color: q.active ? C.a : q.highlight ? C.pu : C.tl, marginTop: 2, fontWeight: 600 }}>
                {q.l}
              </div>
            </div>
          ))}
        </div>
      </Cd>

      {/* ═══ QUICK FEED BOTTOM SHEET — Formula/Pumped amount entry ═══ */}
      {quickFeedType && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 150,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setQuickFeedType(null);
              setQuickFeedVal('');
            }
          }}
        >
          <div
            style={{
              width: '100%',
              background: C.bg,
              borderRadius: '20px 20px 0 0',
              padding: '20px 16px 30px',
              minHeight: '50vh',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: C.t }}>Log {quickFeedType}</h3>
              <button
                onClick={() => {
                  setQuickFeedType(null);
                  setQuickFeedVal('');
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <Ic n="x" s={22} c={C.tl} />
              </button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.tl,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Amount ({volLabel(volumeUnit)})
              </label>
              <Input
                type="number"
                value={quickFeedVal}
                onChange={setQuickFeedVal}
                placeholder={volumeUnit === 'ml' ? 'e.g. 120' : 'e.g. 4'}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn
                label="Save"
                onClick={() => {
                  const num = parseFloat(quickFeedVal) || 0;
                  const ozVal = volumeUnit === 'ml' ? mlToOz(num) : num;
                  quickLog('feed', {
                    type: quickFeedType,
                    oz: ozVal,
                    amount: (quickFeedVal || '0') + ' ' + volLabel(volumeUnit),
                  });
                  setQuickFeedType(null);
                  setQuickFeedVal('');
                }}
                color={C.a}
                full={true}
              />
              <Btn
                label="Cancel"
                onClick={() => {
                  setQuickFeedType(null);
                  setQuickFeedVal('');
                }}
                outline={true}
              />
            </div>
          </div>
        </div>
      )}

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

      {/* Today's Summary with weekly context */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, justifyContent: 'space-between' }}>
        {[
          {
            l: 'Feeds',
            v: feedCt,
            sub: feedOzToday > 0 ? fmtVol(feedOzToday, volumeUnit) : feedMinToday > 0 ? feedMinToday + 'm' : '',
            e: '🍼',
            c: C.a,
            s: 'feed',
            wk: weekFeeds,
            tr: feedTrend,
          },
          { l: 'Diapers', v: diaperCt, sub: '', e: '💧', c: C.bl, s: 'diaper', wk: weekDiapers, tr: diaperTrend },
          { l: 'Sleep', v: sleepCt, sub: sleepHrsToday > 0 ? sleepHrsToday + 'h' : '', e: '😴', c: C.pu, s: 'sleep', wk: weekSleeps, tr: '' },
        ].map((s: any) => (
          <div
            key={s.l}
            onClick={() => {
              setTab('log', s.s);
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 10px',
              background: C.cd,
              borderRadius: 12,
              border: '1px solid ' + C.b,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 16 }}>{s.e}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.t, lineHeight: 1 }}>
                {s.v}
                {s.sub && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: s.c, marginLeft: 3 }}>
                    {s.sub}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 9, color: C.tl }}>{s.l}</div>
              <div style={{ fontSize: 8, color: C.tl, marginTop: 1 }}>
                wk: {s.wk}{s.tr && <span style={{ marginLeft: 2, color: s.tr === '↑' ? C.ok : s.tr === '↓' ? C.p : C.tl }}>{s.tr}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Next feed reminder */}
      {reminders && reminders.enabled && reminders.feedInterval ? (
        (() => {
          const feeds = logs.feed || [];
          const lastFeed = feeds.length > 0 ? feeds[0] : null;
          if (!lastFeed || !lastFeed.time || !lastFeed.date) {
            return (
              <Cd style={{ marginBottom: 12, borderLeft: '4px solid ' + C.w, padding: 14 }}>
                <div style={{ fontSize: 13, color: C.t }}>
                  <Ic n="clock" s={14} c={C.w} st={{ marginRight: 6 }} />
                  No feeds logged today — time to feed?
                </div>
              </Cd>
            );
          }
          const dp2 = lastFeed.date.split('-');
          const parts = lastFeed.time.split(':');
          const lastT = new Date(
            parseInt(dp2[0]),
            parseInt(dp2[1]) - 1,
            parseInt(dp2[2]),
            parseInt(parts[0]),
            parseInt(parts[1]),
            0
          );
          const nextT = new Date(lastT.getTime() + reminders.feedInterval * 3600000);
          const now2 = new Date();

          if (now2 >= nextT) {
            return (
              <Cd style={{ marginBottom: 12, borderLeft: '4px solid ' + C.p, background: C.pl + '44', padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.p }}>
                  <Ic n="clock" s={14} c={C.p} st={{ marginRight: 6 }} />
                  Feeding overdue! Last feed: {fmtTime(lastFeed.time)}
                </div>
              </Cd>
            );
          }
          const hrs = Math.floor((nextT.getTime() - now2.getTime()) / 3600000);
          const mins = Math.floor(((nextT.getTime() - now2.getTime()) % 3600000) / 60000);
          return (
            <Cd style={{ marginBottom: 12, borderLeft: '4px solid ' + C.a, padding: 14 }}>
              <div style={{ fontSize: 13, color: C.t }}>
                <Ic n="clock" s={14} c={C.a} st={{ marginRight: 6 }} />
                Next feed in {hrs > 0 ? hrs + 'h ' : ''}
                {mins}m
              </div>
            </Cd>
          );
        })()
      ) : null}


      {/* Tip */}
      {ms && (
        <Cd style={{ marginBottom: 12, borderLeft: '4px solid ' + C.a }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.a, marginBottom: 3 }}>
            Tip for {ms.l}
          </div>
          <div style={{ fontSize: 12, color: C.t, lineHeight: 1.5 }}>{ms.tips}</div>
        </Cd>
      )}

      {/* Explore links (compact row) */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {[
          { l: 'Activities 🎨', t: 'guide', s: 'activities' },
          { l: 'Safety 🛡️', t: 'safety', s: 'tips' },
          { l: 'Wellness 💜', t: 'guide', s: 'wellness' },
          { l: 'Firsts 📸', t: 'miles', s: 'firsts' },
        ].map((q: any) => (
          <div
            key={q.l}
            onClick={() => {
              setTab(q.t, q.s);
            }}
            style={{
              flex: '1 0 auto',
              padding: '8px 12px',
              textAlign: 'center',
              cursor: 'pointer',
              background: C.cd,
              borderRadius: 10,
              border: '1px solid ' + C.b,
              fontSize: 11,
              fontWeight: 600,
              color: C.t,
              whiteSpace: 'nowrap',
            }}
          >
            {q.l}
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
