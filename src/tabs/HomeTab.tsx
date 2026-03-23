import { useState, useEffect, useRef } from 'react';
import { Card as Cd, SectionHeader as SH, Button as Btn, Pill, Input, Icon as Ic, ProgressCircle as PR } from '@/components/shared';
import VoiceButton from '@/features/voice/VoiceButton';
import { fmtVol, volLabel, mlToOz, ozToMl } from '@/lib/utils/volume';
import { today, now, fmtTime, fmtDate, daysAgo, autoSleepType } from '@/lib/utils/date';
import { C } from '@/lib/constants/colors';
import { MILESTONES } from '@/lib/constants/milestones';
import { toast } from '@/lib/utils/toast';

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

interface MergePromptState {
  mins: number;
  type: string;
  recent: LogEntry;
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
}: HomeTabProps) {
  const [td2, setTd] = useState('');
  const [quickFeedType, setQuickFeedType] = useState<string | null>(null);
  const [quickFeedVal, setQuickFeedVal] = useState('');
  const [mergePrompt, setMergePrompt] = useState<MergePromptState | null>(null);
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
    toast(msg);
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
        // Show merge prompt
        setMergePrompt({ mins: minsInt, type: feedTimer.type, recent: recent });
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
    toast(feedTimer.type + ' — ' + minsInt + ' min logged');
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
  const sleepCt = (logs.sleep || []).filter((x) => x.date === td).length;

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
    weekSleeps += (logs.sleep || []).filter((e) => e.date === dk).length;
  }
  for (let i = 7; i < 14; i++) {
    const dk = daysAgo(i);
    prevWeekFeeds += (logs.feed || []).filter((e) => e.date === dk).length;
    prevWeekDiapers += (logs.diaper || []).filter((e) => e.date === dk).length;
  }
  const feedTrend = weekFeeds > prevWeekFeeds ? '↑' : weekFeeds < prevWeekFeeds ? '↓' : '→';
  const diaperTrend =
    weekDiapers > prevWeekDiapers ? '↑' : weekDiapers < prevWeekDiapers ? '↓' : '→';

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
    <div style={{ padding: '16px 16px 120px' }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, color: C.tl, fontWeight: 500 }}>BabyBloom</div>
        {babyName !== 'Baby' && (
          <div style={{ fontSize: 12, color: C.p, fontWeight: 600 }}>{babyName}</div>
        )}
      </div>

      {/* Hero (compact) */}
      <Cd
        style={{
          background: `linear-gradient(135deg,${C.p},${C.s})`,
          border: 'none',
          marginBottom: 12,
          padding: '14px 20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>Your baby is</div>
            <div style={{ color: 'white', fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
              {ageStr}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 }}>
              {ms ? 'Stage: ' + ms.l : ''}
            </div>
          </div>
          <div style={{ fontSize: 42 }}>{ms ? ms.e : '👶'}</div>
        </div>
      </Cd>

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

      {/* ═══ QUICK LOG — always visible, prominent ═══ */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t, marginBottom: 8 }}>Quick Log</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 5 }}>
          {/* Row 1: feeding — Breast L/R start inline timer, Formula/Pumped open form */}
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
            {
              e: '🧒',
              l: 'Tummy',
              fn: () => startFeedTimer('Tummy Time'),
              active: feedTimer && feedTimer.type === 'Tummy Time',
              dis: feedTimer && feedTimer.type !== 'Tummy Time',
            },
          ].map((q: any) => (
            <div
              key={q.l}
              onClick={q.dis ? null : q.fn}
              style={{
                textAlign: 'center',
                padding: '8px 2px',
                borderRadius: 12,
                background: q.active ? C.al : C.cd,
                border: '1px solid ' + (q.active ? C.a : C.b),
                cursor: q.dis ? 'default' : 'pointer',
                opacity: q.dis ? 0.35 : 1,
              }}
            >
              <div style={{ fontSize: 18 }}>{q.e}</div>
              <div style={{ fontSize: 9, color: q.active ? C.a : C.tl, marginTop: 2, fontWeight: 600 }}>
                {q.l}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginTop: 5 }}>
          {/* Row 2: diaper + sleep grouped */}
          {[
            { e: '💧', l: 'Wet', fn: () => quickLog('diaper', { type: 'Wet' }) },
            { e: '💩', l: 'Dirty', fn: () => quickLog('diaper', { type: 'Dirty' }) },
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
            },
          ].map((q: any) => (
            <div
              key={q.l}
              onClick={q.fn}
              style={{
                textAlign: 'center',
                padding: '8px 2px',
                borderRadius: 12,
                background: q.l === 'Wake Up' ? C.pul : C.cd,
                border: '1px solid ' + (q.l === 'Wake Up' ? C.pu : C.b),
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 18 }}>{q.e}</div>
              <div
                style={{
                  fontSize: 9,
                  color: q.l === 'Wake Up' ? C.pu : C.tl,
                  marginTop: 2,
                  fontWeight: 600,
                }}
              >
                {q.l}
              </div>
            </div>
          ))}
        </div>
      </div>

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

      {/* ═══ CONTINUE LAST FEED — shows when recent feed within 30 min, no timer running ═══ */}
      {!feedTimer &&
        (() => {
          const rf = getRecentFeed(null);
          if (!rf) return null;
          const elapsed = rf.mins || 0;
          return (
            <div
              style={{
                marginTop: 10,
                marginBottom: 12,
                padding: '10px 14px',
                background: C.okl,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 16 }}>🔄</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.ok || C.t }}>
                    Continue {rf.type}?
                  </div>
                  <div style={{ fontSize: 10, color: C.tl }}>
                    {elapsed} min so far • tap to resume timer
                  </div>
                </div>
              </div>
              <div
                onClick={() => {
                  startFeedTimer(rf.type);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 10,
                  background: C.ok || C.a,
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Resume
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

      {/* Today's Summary (compact inline) */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, justifyContent: 'space-between' }}>
        {[
          {
            l: 'Feeds',
            v: feedCt,
            sub: feedOzToday > 0 ? fmtVol(feedOzToday, volumeUnit) : feedMinToday > 0 ? feedMinToday + 'm' : '',
            e: '🍼',
            c: C.a,
            s: 'feed',
          },
          { l: 'Diapers', v: diaperCt, sub: '', e: '💧', c: C.bl, s: 'diaper' },
          { l: 'Sleep', v: sleepCt, sub: sleepHrsToday > 0 ? sleepHrsToday + 'h' : '', e: '😴', c: C.pu, s: 'sleep' },
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

      {/* Weekly Summary (inline compact) */}
      <div
        style={{
          marginBottom: 12,
          padding: '8px 12px',
          background: C.cd,
          borderRadius: 12,
          border: '1px solid ' + C.b,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: C.tl }}>Week:</div>
        {[
          { l: 'Feed', v: weekFeeds, tr: feedTrend, c: C.a },
          { l: 'Diaper', v: weekDiapers, tr: diaperTrend, c: C.bl },
          { l: 'Sleep', v: weekSleeps, tr: '', c: C.pu },
        ].map((s: any) => (
          <div key={s.l} style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.t }}>{s.v}</span>
            {s.tr && (
              <span
                style={{
                  fontSize: 10,
                  color: s.tr === '↑' ? C.ok : s.tr === '↓' ? C.p : C.tl,
                  marginLeft: 2,
                }}
              >
                {s.tr}
              </span>
            )}
            <div style={{ fontSize: 9, color: C.tl }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Quick nav row: Stats + Milestones + Vaccines */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <Cd
          onClick={() => {
            setTab('log', 'stats');
          }}
          style={{ padding: 12, textAlign: 'center', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 20 }}>📊</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.t, marginTop: 2 }}>Stats</div>
        </Cd>
        <Cd
          onClick={() => {
            setTab('miles', 'dev');
          }}
          style={{ padding: 12, textAlign: 'center', cursor: 'pointer' }}
        >
          <div>
            <PR pct={pct} sz={32} sw={3} color={C.a} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.t, marginTop: 2 }}>{pct}% Done</div>
        </Cd>
        <Cd
          onClick={() => {
            setTab('guide', 'vaccines');
          }}
          style={{ padding: 12, textAlign: 'center', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 20 }}>💉</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.t, marginTop: 2 }}>Vaccines</div>
        </Cd>
      </div>

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

      {/* ═══ FEED MERGE PROMPT ═══ */}
      {mergePrompt && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 250,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: C.cd,
              borderRadius: 20,
              padding: '28px 24px',
              maxWidth: 340,
              width: '88%',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>🍼</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.t, marginBottom: 6 }}>
              {mergePrompt.type} — {mergePrompt.mins} min
            </div>
            <div style={{ fontSize: 13, color: C.tl, marginBottom: 16, lineHeight: 1.5 }}>
              Last feed was{' '}
              <strong>
                {mergePrompt.recent.type} ({mergePrompt.recent.amount || '?'})
              </strong>{' '}
              at <strong>{fmtTime(mergePrompt.recent.time)}</strong>. Same session?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => {
                  mergeIntoLastFeed(mergePrompt.mins, mergePrompt.type);
                  setMergePrompt(null);
                }}
                style={{
                  padding: '14px 20px',
                  borderRadius: 14,
                  background: C.s,
                  color: 'white',
                  border: 'none',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Add to previous feed ({(mergePrompt.recent.mins || 0) + mergePrompt.mins} min total)
              </button>
              <button
                onClick={() => {
                  const entry: LogEntry = {
                    date: today(),
                    time: now(),
                    id: Date.now(),
                    type: mergePrompt.type,
                    amount: mergePrompt.mins + ' min',
                    mins: mergePrompt.mins,
                    notes: 'Timed',
                  };
                  const next = Object.assign({}, logs);
                  next.feed = [entry].concat(logs.feed || []);
                  setLogs(next);
                  toast(mergePrompt.type + ' — ' + mergePrompt.mins + ' min logged as new');
                  setMergePrompt(null);
                }}
                style={{
                  padding: '12px 20px',
                  borderRadius: 14,
                  background: C.bg,
                  border: '1px solid ' + C.b,
                  color: C.t,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Log as separate feed
              </button>
              <button
                onClick={() => {
                  setMergePrompt(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.tl,
                  fontSize: 13,
                  cursor: 'pointer',
                  padding: 8,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
