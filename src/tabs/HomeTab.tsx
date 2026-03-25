import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card as Cd, Button as Btn, ProgressCircle as PR } from '@/components/shared';
import { ds, dg } from '@/lib/db';
import VoiceButton from '@/features/voice/VoiceButton';
import { fmtVol, volLabel, mlToOz } from '@/lib/utils/volume';
import { today, now, fmtTime, daysAgo, autoSleepType, calcSleepMins } from '@/lib/utils/date';
import { C } from '@/lib/constants/colors';
import { MILESTONES } from '@/lib/constants/milestones';
import type { CountryConfig, CountryCode } from '@/lib/constants/countries';
import { getAvailableCountries } from '@/lib/constants/countries';
import { toast } from '@/lib/utils/toast';
import { isValidBirthDate } from '@/lib/utils/validate';
import WelcomeCarousel from '@/components/onboarding/WelcomeCarousel';
import { getEncouragement } from '@/lib/constants/encouragements';
import useDynamicRedFlags from '@/features/insights/useDynamicRedFlags';
import useMomAlerts from '@/features/insights/useMomAlerts';
import MomCare from '@/features/wellness/MomCare';

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
  quickFeedType: string | null;
  setQuickFeedType: (v: string | null) => void;
  sliderVal: number;
  setSliderVal: (v: number) => void;
  countryConfig: CountryConfig;
  country: CountryCode;
  setCountry: (code: CountryCode) => void;
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
  quickFeedType,
  setQuickFeedType,
  sliderVal,
  setSliderVal,
  countryConfig,
  country,
  setCountry,
}: HomeTabProps) {
  const VACCINES = countryConfig.vaccines;
  const countries = getAvailableCountries();
  const [td2, setTd] = useState('');
  const [showSlider] = useState(false); // kept for stable hook count
  const [carouselIdx, setCarouselIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);
  // Merge prompt state kept for type compatibility but auto-merge is used instead
  const mergeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [feedElapsed, setFeedElapsed] = useState(
    feedTimerApp ? Math.floor((Date.now() - feedTimerApp.startTime) / 1000) : 0
  );
  const feedIntRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [flashBtn, setFlashBtn] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [revealStage, setRevealStage] = useState<number | null>(null);
  const [undoEntry, setUndoEntry] = useState<{ cat: string; entry: LogEntry; msg: string } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFlash = useCallback((label: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashBtn(label);
    flashTimerRef.current = setTimeout(() => setFlashBtn(null), 500);
  }, []);

  // ═══ Sleep detection (move before quickLogWarnings so it can suppress sleep-time warnings) ═══
  const lastSleepEntry = (logs.sleep || []).find(
    (e) => e.type === 'Nap' || e.type === 'Night Sleep' || e.type === 'Wake Up'
  );
  let isSleeping =
    lastSleepEntry && (lastSleepEntry.type === 'Nap' || lastSleepEntry.type === 'Night Sleep') || false;

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

  // ═══ Quick-log warning colors — highlight important buttons not used recently ═══
  const quickLogWarnings = useMemo(() => {
    // Thresholds in hours: [warningStart, dangerStart]
    // After warningStart hours → amber tint; after dangerStart hours → red tint
    const babyAgeMonths = Math.floor(age);
    const thresholds: Record<string, { cat: string; types: string[]; warnH: number; dangerH: number; warnMsg: string; dangerMsg: string; neverMsg: string }> = {
      'Nurse Left': { cat: 'feed', types: ['Breast L'], warnH: 5, dangerH: 8, warnMsg: 'Left side not nursed in over {h}h', dangerMsg: 'Left side not nursed in over {h}h — might be time for a feed', neverMsg: 'No left side nursing logged yet' },
      'Nurse Right': { cat: 'feed', types: ['Breast R'], warnH: 5, dangerH: 8, warnMsg: 'Right side not nursed in over {h}h', dangerMsg: 'Right side not nursed in over {h}h — might be time for a feed', neverMsg: 'No right side nursing logged yet' },
      // Tummy time warnings: skip for newborns < 1 month (warning fires immediately when never logged, causing alarm for brand-new parents)
      ...(babyAgeMonths >= 1 && babyAgeMonths < 12 ? { 'Tummy': { cat: 'tummy', types: ['Tummy Time'], warnH: 48, dangerH: 72, warnMsg: 'No tummy time in over {h}h', dangerMsg: 'No tummy time in {h}h — good time for some tummy play', neverMsg: 'No tummy time logged yet' } } : {}),
      'Wet':      { cat: 'diaper', types: ['Wet'], warnH: 6, dangerH: 12, warnMsg: 'No wet diaper in {h}h', dangerMsg: 'No wet diaper in {h}h — keep an eye on hydration', neverMsg: 'No wet diapers logged yet' },
      'Dirty':    { cat: 'diaper', types: ['Dirty'], warnH: 36, dangerH: 72, warnMsg: 'No dirty diaper in {h}h', dangerMsg: 'No dirty diaper in {h}h — this can be normal — mention at next checkup if it continues', neverMsg: 'No dirty diapers logged yet' },
      ...(babyAgeMonths >= 6 ? { 'Solids': { cat: 'feed', types: ['Solids'], warnH: 12, dangerH: 24, warnMsg: 'No solids in {h}h', dangerMsg: 'No solids in {h}h — might be time for a meal', neverMsg: 'No solids logged yet — start introducing at 6 months' } } : {}),
    };
    const warnings: Record<string, { level: 'warn' | 'danger'; reason: string } | null> = {};
    const nowMs = Date.now();
    for (const [label, cfg] of Object.entries(thresholds)) {
      // Suppress feed warnings when baby is sleeping
      if (isSleeping && (label === 'Nurse Left' || label === 'Nurse Right' || label === 'Solids')) {
        warnings[label] = null;
        continue;
      }
      // Suppress tummy time warnings when baby is sleeping
      if (isSleeping && label === 'Tummy') {
        warnings[label] = null;
        continue;
      }

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
  }, [logs, birth, isSleeping]);

  // Rich long-press info panel state
  interface QlInfoPanel {
    label: string;
    emoji: string;
    warn: { level: 'warn' | 'danger'; reason: string } | null;
    cat: string;
    types: string[];
    history: LogEntry[];
    tips: string[];
    settingKey?: string; // key for default-value setting (e.g. 'Formula', 'Pumped')
  }
  const [qlInfoPanel, setQlInfoPanel] = useState<QlInfoPanel | null>(null);

  // ─── Quick-log default amounts (persisted in IndexedDB) ───
  const [qlDefaults, setQlDefaults] = useState<Record<string, number>>({});
  useEffect(() => {
    dg('ql_defaults').then((saved: Record<string, number> | null) => {
      if (saved) setQlDefaults(saved);
    });
  }, []);
  const saveQlDefault = useCallback((key: string, val: number | null) => {
    setQlDefaults((prev) => {
      const next = { ...prev };
      if (val === null) delete next[key];
      else next[key] = val;
      ds('ql_defaults', next);
      return next;
    });
  }, []);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  // Category info for long-press panels
  const qlCategoryInfo: Record<string, { cat: string; types: string[]; tips: string[]; settingKey?: string }> = {
    'Nurse Left': { cat: 'feed', types: ['Breast L'], tips: ['Alternate sides each feed for balanced supply', 'Aim for 8-12 feeds per day in the first month', 'Watch for hunger cues: rooting, lip smacking'] },
    'Nurse Right': { cat: 'feed', types: ['Breast R'], tips: ['Alternate sides each feed for balanced supply', 'Aim for 8-12 feeds per day in the first month', 'Watch for hunger cues: rooting, lip smacking'] },
    'Formula': { cat: 'feed', types: ['Formula'], tips: ['Follow package instructions for mixing ratio', 'Prepared formula is good for 1 hour at room temp', 'Never microwave — warm in bowl of warm water'], settingKey: 'Formula' },
    'Wet': { cat: 'diaper', types: ['Wet'], tips: ['6+ wet diapers per day indicates good hydration', 'Pale or clear urine is normal', 'Fewer than 4 wet diapers may signal dehydration'] },
    'Dirty': { cat: 'diaper', types: ['Dirty'], tips: ['Color and consistency vary — most are normal', 'Breastfed babies may go days without a stool', 'Call doctor for white, red, or black stools'] },
    'Sleep': { cat: 'sleep', types: ['Nap', 'Night Sleep'], tips: ['Newborns sleep 14-17 hours total per day', 'Always place on back for safe sleep', 'Consistent routine helps establish patterns'] },
    'Wake Up': { cat: 'sleep', types: ['Wake Up'], tips: ['Note wake windows for schedule planning', 'Short wake windows (45-90min) for newborns', 'Fussiness often signals overtiredness'] },
    'Tummy': { cat: 'tummy', types: ['Tummy Time'], tips: ['Start with 3-5 minutes, build up gradually', 'Best on a firm, flat surface', 'Try after diaper changes when baby is alert', 'Aim for 15-30 min total daily by 2 months'] },
    'Solids': { cat: 'feed', types: ['Solids'], tips: ['Introduce one new food every 3-5 days', 'Watch for allergic reactions after new foods', 'Let baby set the pace — never force feed'] },
    'Pumped': { cat: 'feed', types: ['Pumped'], tips: ['Store pumped milk in refrigerator up to 5 days', 'Label each container with date and time', 'Room temperature: use within 4 hours'], settingKey: 'Pumped' },
  };

  const startLongPress = useCallback((label: string, emoji: string) => {
    clearLongPress();
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      const info = qlCategoryInfo[label];
      if (!info) return;
      const warnInfo = quickLogWarnings[label] || null;
      // Get recent history entries
      const entries = logs[info.cat] || [];
      const history = entries
        .filter((e: any) => info.types.includes(e.type) || (e.sides && info.types.some((t: string) => e.sides.includes(t))))
        .slice(0, 5);
      setQlInfoPanel({
        label,
        emoji,
        warn: warnInfo,
        cat: info.cat,
        types: info.types,
        history,
        tips: info.tips,
        settingKey: info.settingKey,
      });
    }, 400);
  }, [clearLongPress, quickLogWarnings, logs, qlCategoryInfo]);

  // Clear info panel on unmount (tab change)
  useEffect(() => {
    return () => setQlInfoPanel(null);
  }, []);

  // ═══ Dynamic red flags — data-driven P0 alerts from recent logs ═══
  const dynamicRedFlags = useDynamicRedFlags(logs, age, birth, isSleeping);
  const momAlerts = useMomAlerts();

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

  // Welcome carousel — full-screen overlay, blocks everything beneath
  if (showWelcome) {
    return (
      <WelcomeCarousel
        countryConfig={countryConfig}
        babyName={babyName}
        onDismiss={() => {
          setShowWelcome(false);
          setRevealStage(0);
          setTimeout(() => setRevealStage(1), 150);
          setTimeout(() => setRevealStage(2), 400);
          setTimeout(() => setRevealStage(3), 650);
          setTimeout(() => setRevealStage(4), 900);
          setTimeout(() => setRevealStage(null), 1400);
        }}
      />
    );
  }

  // Welcome screen if no birth date
  if (!birth) {
    const selCountry = countries.find((c) => c.code === country);
    return (
      <div style={{ padding: '40px 20px 32px', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* Decorative header */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px',
          background: `linear-gradient(135deg, ${C.p}, ${C.s})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 24px ${C.p}44`,
        }}>
          <span style={{ fontSize: 38 }}>🍼</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.t, marginBottom: 4 }}>
          Welcome to BabyBloom
        </h1>
        <p style={{ color: C.tl, fontSize: 14, marginBottom: 28, lineHeight: 1.5 }}>
          Your baby care companion
        </p>

        {/* Unified onboarding card */}
        <Cd style={{ maxWidth: 360, margin: '0 auto', padding: '28px 24px 24px', borderRadius: 20 }}>
          {/* Step 1: Country */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                background: `linear-gradient(135deg, ${C.p}, ${C.s})`, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>1</div>
              <span style={{ fontWeight: 700, fontSize: 14, color: C.t }}>Your country</span>
              <span style={{ fontSize: 11, color: C.tl, marginLeft: 'auto' }}>
                {selCountry ? `${selCountry.flag} ${selCountry.name}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {countries.map((c) => {
                const sel = country === c.code;
                return (
                  <div
                    key={c.code}
                    onClick={() => setCountry(c.code)}
                    style={{
                      flex: 1, padding: '12px 8px', borderRadius: 14, cursor: 'pointer',
                      border: `2px solid ${sel ? C.p : C.b}`,
                      background: sel ? `linear-gradient(135deg, ${C.pl}88, ${C.pl}44)` : C.bg,
                      textAlign: 'center', transition: 'all 0.2s',
                      transform: sel ? 'scale(1.03)' : 'scale(1)',
                    }}
                  >
                    <div style={{ fontSize: 26, lineHeight: 1 }}>{c.flag}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.t, marginTop: 5 }}>{c.name}</div>
                    <div style={{ fontSize: 9, color: sel ? C.p : C.tl, marginTop: 2, fontWeight: sel ? 600 : 400 }}>
                      {c.code === 'US' ? 'AAP/CDC' : c.code === 'IN' ? 'IAP' : ''} schedule
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: C.b, margin: '0 -4px 20px' }} />

          {/* Step 2: Birth date */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                background: `linear-gradient(135deg, ${C.p}, ${C.s})`, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>2</div>
              <span style={{ fontWeight: 700, fontSize: 14, color: C.t }}>Baby's birth date</span>
            </div>

            <div
              onClick={() => {
                const inp = document.getElementById('bb-birth-input');
                if (inp) (inp as HTMLInputElement).showPicker?.();
                inp?.focus();
              }}
              style={{
                position: 'relative', padding: '14px 14px', borderRadius: 14,
                border: `2px solid ${td2 ? C.p : C.b}`,
                background: td2 ? C.pl + '33' : C.bg,
                cursor: 'pointer', transition: 'border 0.2s, background 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>📅</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: td2 ? C.t : C.tl }}>
                {td2 ? new Date(td2 + 'T00:00').toLocaleDateString(countryConfig.defaultLocale, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Tap to select date'}
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
          </div>

          {/* Action buttons */}
          <div style={{ marginTop: 22 }}>
            <Btn
              label={td2 ? `Get Started ${selCountry?.flag || ''}` : 'Select a date to continue'}
              onClick={() => {
                if (!td2 || !isValidBirthDate(td2)) { toast('Please enter a valid birth date (not in the future)'); return; }
                setShowWelcome(true);
                setBirth(td2);
              }}
              color={C.p}
              full={true}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <Btn
              label="Baby just born today"
              onClick={() => { setShowWelcome(true); setBirth(today()); }}
              outline={true}
              full={true}
            />
          </div>
        </Cd>

        <div style={{ marginTop: 20, fontSize: 11, color: C.tl, lineHeight: 1.6 }}>
          {countryConfig.medical.authority} & WHO guidelines
          <span style={{ margin: '0 6px', opacity: 0.4 }}>|</span>
          Data stays on your device
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

    // Set undo state with emoji and auto-dismiss after 5 seconds
    const emojis: Record<string, string> = {
      feed: '🍼',
      diaper: '👶',
      sleep: '😴',
      tummy: '🤸',
    };
    const emoji = emojis[cat] || '✓';
    setUndoEntry({ cat, entry: e, msg: emoji });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoEntry(null), 5000);
  }

  // ═══ Undo log helper ═══
  function undoLog() {
    if (!undoEntry) return;
    const { cat, entry } = undoEntry;
    const updated = Object.assign({}, logs);
    const entries = (updated[cat] || []) as LogEntry[];
    // Remove the entry that matches the id
    updated[cat] = entries.filter((e) => e.id !== entry.id);
    setLogs(updated);
    setUndoEntry(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
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
    if (diffMin <= 30) {
      if (!type || last.type === type) return last;
      // Allow merging between breast sides (Breast L ↔ Breast R) only
      const isMergeableBreast =
        (type === 'Breast L' || type === 'Breast R') &&
        (last.type === 'Breast L' || last.type === 'Breast R');
      if (isMergeableBreast) return last;
    }
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
      const recent = getRecentFeed(feedTimer.type);
      if (recent) {
        // Auto-merge into previous feed silently (only merges same-type or breast L↔R)
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

  // ═══ Weekly stats ═══
  let weekFeeds = 0,
    weekDiapers = 0;
  for (let i = 0; i < 7; i++) {
    const dk = daysAgo(i);
    weekFeeds += (logs.feed || []).filter((e) => e.date === dk).length;
    weekDiapers += (logs.diaper || []).filter((e) => e.date === dk).length;
  }

  // ═══ Next critical action (vaccine) ═══
  const ageToMonths: { [key: string]: number } = (() => {
    const map: { [key: string]: number } = { Birth: 0 };
    VACCINES.forEach((v) => {
      const a = v.age;
      if (a === 'Birth') return;
      const weekMatch = a.match(/(\d+)\s*weeks?/i);
      if (weekMatch) { map[a] = Math.round(parseInt(weekMatch[1]) / 4.33 * 10) / 10; return; }
      const moMatch = a.match(/(\d+)/);
      if (moMatch) { map[a] = parseInt(moMatch[1]); }
    });
    return map;
  })();

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

  // Staggered reveal after onboarding carousel
  const reveal = (stage: number): React.CSSProperties =>
    revealStage !== null
      ? {
          opacity: revealStage >= stage ? 1 : 0,
          transform: revealStage >= stage ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.45s ease-out, transform 0.45s ease-out',
        }
      : {};

  return (
    <div className="ca" style={{ padding: '16px 16px 120px' }}>
      {/* Undo banner */}
      {undoEntry && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: C.a,
            color: 'white',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 1000,
            animation: 'ql-undo-slide 0.3s ease-out',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <span>{undoEntry.msg} Logged — Undo</span>
          <button
            onClick={undoLog}
            style={{
              background: 'white',
              color: C.a,
              border: 'none',
              borderRadius: 20,
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              minWidth: 60,
            }}
          >
            Undo
          </button>
        </div>
      )}

      {/* Hero — premium baby dashboard */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 24,
          marginBottom: 12,
          ...reveal(0),
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
      <div style={reveal(1)}>
      {(() => {
        const slides: { id: string; node: React.ReactNode; priority: number }[] = [];

        // ── Baby alerts — each flag is its own compact card ──
        dynamicRedFlags.forEach((rf) => {
          const isCritical = rf.severity === 'critical';
          const borderColor = isCritical ? C.p : C.w;
          const bgColor = isCritical ? C.pl : C.wl;
          slides.push({
            id: 'rf-' + rf.id,
            priority: isCritical ? 0 : 1,
            node: (
              <div style={{
                padding: '8px 10px', borderRadius: 12,
                borderLeft: '3px solid ' + borderColor, background: bgColor,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: 14 }}>{rf.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: borderColor }}>
                    {rf.id === 'feed-gap' ? (isCritical ? 'Feed now' : 'Feed soon')
                      : rf.id === 'low-wet' ? 'Check hydration'
                      : rf.id === 'dirty-gap' ? 'Check diaper'
                      : rf.id === 'feed-drop' ? 'Intake dropping'
                      : rf.id === 'tummy-gap' ? 'Tummy time'
                      : 'Heads up'}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: C.t, lineHeight: 1.4 }}>
                  {rf.text}
                </div>
              </div>
            ),
          });
        });

        // ── Mom wellness alerts — same compact card style ──
        momAlerts.forEach((ma) => {
          const isCritical = ma.severity === 'critical';
          const borderColor = isCritical ? C.p : '#9C7CF4';
          const bgColor = isCritical ? C.pl : '#9C7CF4' + '18';
          slides.push({
            id: 'mom-' + ma.id,
            priority: isCritical ? 0 : 1,
            node: (
              <div style={{
                padding: '8px 10px', borderRadius: 12,
                borderLeft: '3px solid ' + borderColor, background: bgColor,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: 14 }}>{ma.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: borderColor }}>
                    {ma.id === 'mom-water' ? 'Stay hydrated'
                      : ma.id === 'mom-meal' ? 'Eat something'
                      : ma.id === 'mom-sleep' ? 'Rest up'
                      : ma.id === 'mom-mood' ? 'How you\'re doing'
                      : ma.id === 'mom-vitamin' ? 'Vitamin reminder'
                      : 'Self-care check'}
                  </span>
                  <span style={{ fontSize: 8, color: C.tl, marginLeft: 'auto', fontWeight: 600 }}>For you</span>
                </div>
                <div style={{ fontSize: 10, color: C.t, lineHeight: 1.4 }}>
                  {ma.text}
                </div>
              </div>
            ),
          });
        });

        // ── Overdue vaccine (priority 0 if overdue, 2 if upcoming) ──
        if (nextAction) {
          slides.push({
            id: 'vaccine',
            priority: nextAction.overdue ? 0 : 2,
            node: (
              <div style={{ padding: '8px 10px', borderLeft: '3px solid ' + (nextAction.overdue ? C.p : C.bl), background: nextAction.overdue ? C.pl + '22' : C.bll + '44', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      <span style={{ fontSize: 14 }}>{nextAction.overdue ? '⚠️' : '💉'}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: nextAction.overdue ? C.p : C.bl }}>
                        {nextAction.vaccine.n} — {nextAction.vaccine.d}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: C.tl }}>Due at {nextAction.ageLabel}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 6 }}>
                    <div
                      onClick={() => {
                        setVDone((p) => {
                          const n = Object.assign({}, p);
                          n[nextAction.key] = true;
                          return n;
                        });
                        toast('Marked ' + nextAction.vaccine.n + ' as done!');
                      }}
                      style={{ padding: '5px 10px', borderRadius: 8, background: C.ok, color: 'white', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                    >Done</div>
                    <div
                      onClick={() => { setTab('guide', 'vaccines'); }}
                      style={{ padding: '5px 8px', borderRadius: 8, background: C.cd, border: '1px solid ' + C.b, color: C.tl, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                    >All</div>
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
              <div style={{ padding: '8px 10px', borderLeft: '3px solid ' + C.a, background: C.cd, borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: 14 }}>💡</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.a }}>Tip for {ms.l}</span>
                </div>
                <div style={{ fontSize: 10, color: C.t, lineHeight: 1.4 }}>{ms.tips}</div>
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
            {/* Show current slide with generous peek of next */}
            <div style={{ display: 'flex', gap: 6, transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1)', transform: slides.length > 1 ? `translateX(calc(-${idx} * (76% + 6px)))` : undefined }}>
              {slides.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    flex: '0 0 ' + (slides.length > 1 ? '76%' : '100%'),
                    opacity: i === idx ? 1 : 0.45,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  {s.node}
                </div>
              ))}
            </div>
            {slides.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 5 }}>
                {slides.map((s, i) => (
                  <div
                    key={s.id}
                    onClick={() => setCarouselIdx(i)}
                    style={{
                      width: i === idx ? 14 : 5,
                      height: 5,
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
      </div>

      {/* ═══ QUICK LOG — unified card with timer, quantity selector & grid ═══ */}
      <Cd style={{ marginBottom: 12, padding: '14px 14px 12px', overflow: 'hidden', ...reveal(2) }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t, marginBottom: 8 }}>Quick Log</div>
        {(() => {
          const isMl = volumeUnit === 'ml';
          const presets = isMl ? [30, 60, 90, 120, 150, 180] : [1, 2, 3, 4, 5, 6];
          const unit = volLabel(volumeUnit);
          const sliderMax = isMl ? 300 : 10;
          const sliderStep = isMl ? 10 : 0.5;
          const closeQL = () => { setQuickFeedType(null); setSliderVal(0); };
          const logAmount = (val: number) => {
            const ozVal = isMl ? mlToOz(val) : val;
            quickLog('feed', { type: quickFeedType!, oz: ozVal, amount: val + ' ' + unit }, quickFeedType!);
            closeQL();
          };

          // Whether there's an active timer context (feed timer or sleeping)
          const hasActiveTimer = !!feedTimer || !!isSleeping;
          // Timer display info
          const timerEmoji = feedTimer
            ? (feedTimer.type === 'Tummy Time' ? '🧒' : '🤱')
            : '😴';
          const timerLabel = feedTimer
            ? feedTimer.type
            : (lastSleepEntry ? lastSleepEntry.type : 'Sleep');
          const timerSince = feedTimer
            ? fmtTime(feedTimer.startTimeStr)
            : (lastSleepEntry ? fmtTime(lastSleepEntry.time) : '');
          const timerColor = feedTimer ? C.a : C.pu;
          const timerBgColor = feedTimer ? C.al : C.pul;

          // Nudge thresholds for feed timer
          const nudgeThresholds: { [key: string]: number } = {
            'Breast L': 35 * 60, 'Breast R': 35 * 60, 'Tummy Time': 20 * 60,
          };
          const feedThreshold = feedTimer ? (nudgeThresholds[feedTimer.type] || 45 * 60) : 0;
          const isLong = feedTimer ? feedElapsed >= feedThreshold : false;

          // Companion items — things you can log while a timer is running
          const companionItems: { e: string; l: string; fn: () => void }[] = [];
          if (feedTimer) {
            // During breast/tummy/feed: can log diapers and sleep
            companionItems.push(
              { e: '💧', l: 'Wet', fn: () => quickLog('diaper', { type: 'Wet' }, 'Wet') },
              { e: '💩', l: 'Dirty', fn: () => quickLog('diaper', { type: 'Dirty' }, 'Dirty') },
            );
            if (!isSleeping) {
              companionItems.push({
                e: '😴', l: 'Sleep',
                fn: () => quickLog('sleep', { type: autoSleepType() }, 'Sleep'),
              });
            }
            // If breast feeding, offer switch to the other side
            if (feedTimer.type === 'Breast L') {
              companionItems.push({
                e: '🔄', l: 'Switch R',
                fn: () => { stopFeedTimer(); startFeedTimer('Breast R'); },
              });
            } else if (feedTimer.type === 'Breast R') {
              companionItems.push({
                e: '🔄', l: 'Switch L',
                fn: () => { stopFeedTimer(); startFeedTimer('Breast L'); },
              });
            }
          } else if (isSleeping) {
            // During sleep: can log diapers and feeds
            companionItems.push(
              { e: '💧', l: 'Wet', fn: () => quickLog('diaper', { type: 'Wet' }, 'Wet') },
              { e: '💩', l: 'Dirty', fn: () => quickLog('diaper', { type: 'Dirty' }, 'Dirty') },
              { e: '🍼', l: 'Formula', fn: () => { const def = qlDefaults['Formula']; if (def) { const ozVal = isMl ? mlToOz(def) : def; quickLog('feed', { type: 'Formula', oz: ozVal, amount: def + ' ' + unit }, 'Formula'); } else { setQuickFeedType('Formula'); setSliderVal(presets[0]); } } },
            );
          }

          // Age-adaptive quick log items
          // Shared item definitions
          const qlBreastL = { e: '🤱', l: 'Nurse Left', fn: () => startFeedTimer('Breast L'), active: feedTimer && feedTimer.type === 'Breast L', dis: feedTimer && feedTimer.type !== 'Breast L', needsQty: false };
          const qlBreastR = { e: '🤱', l: 'Nurse Right', fn: () => startFeedTimer('Breast R'), active: feedTimer && feedTimer.type === 'Breast R', dis: feedTimer && feedTimer.type !== 'Breast R', needsQty: false };
          const qlFormula = { e: '🍼', l: 'Formula', fn: () => { if (!feedTimer) { const def = qlDefaults['Formula']; if (def) { const ozVal = isMl ? mlToOz(def) : def; quickLog('feed', { type: 'Formula', oz: ozVal, amount: def + ' ' + unit }, 'Formula'); } else { setQuickFeedType('Formula'); setSliderVal(presets[0]); } } }, dis: !!feedTimer, needsQty: !qlDefaults['Formula'], qType: 'Formula' };
          const qlPumped  = { e: '🍼', l: 'Pumped', fn: () => { if (!feedTimer) { const def = qlDefaults['Pumped']; if (def) { const ozVal = isMl ? mlToOz(def) : def; quickLog('feed', { type: 'Pumped Milk', oz: ozVal, amount: def + ' ' + unit }, 'Pumped'); } else { setQuickFeedType('Pumped Milk'); setSliderVal(presets[0]); } } }, dis: !!feedTimer, needsQty: !qlDefaults['Pumped'], qType: 'Pumped Milk' };
          const qlTummy   = { e: '🧒', l: 'Tummy', fn: () => quickLog('tummy', { type: 'Tummy Time' }, 'Tummy'), active: false, dis: false, needsQty: false };
          const qlWet     = { e: '💧', l: 'Wet', fn: () => quickLog('diaper', { type: 'Wet' }, 'Wet'), active: false, dis: false, needsQty: false };
          const qlDirty   = { e: '💩', l: 'Dirty', fn: () => quickLog('diaper', { type: 'Dirty' }, 'Dirty'), active: false, dis: false, needsQty: false };
          const qlSleepItem = { e: isSleeping ? '⏰' : '😴', l: isSleeping ? 'Wake Up' : 'Sleep', fn: () => { if (isSleeping) quickLog('sleep', { type: 'Wake Up' }, 'Wake Up'); else quickLog('sleep', { type: autoSleepType() }, 'Sleep'); }, active: false, dis: false, highlight: isSleeping, needsQty: false };
          const qlSolids  = { e: '🥣', l: 'Solids', fn: () => quickLog('feed', { type: 'Solids' }, 'Solids'), active: false, dis: false, needsQty: false };

          // Select age-appropriate items:
          // 12+ months (toddler): solids first, no tummy time (walking age)
          // 6–11 months (solids intro): add solids, keep tummy time (crawling/rolling)
          // 0–5 months (newborn/infant): classic nursing/bottle/tummy/diaper/sleep set
          const qlItems =
            ageMonths >= 12
              ? [qlSolids, qlSleepItem, qlWet, qlDirty, qlBreastL, qlBreastR, qlFormula, qlPumped]
              : ageMonths >= 6
                ? [qlBreastL, qlBreastR, qlSolids, qlFormula, qlPumped, qlTummy, qlWet, qlDirty, qlSleepItem]
                : [qlBreastL, qlBreastR, qlFormula, qlPumped, qlTummy, qlWet, qlDirty, qlSleepItem];

          // ─── Expanded inline quantity selector (Formula / Pumped) ───
          if (quickFeedType) {
            const activeItem = qlItems.find((q) => (q as any).qType === quickFeedType);
            const displayVal = isMl ? Math.round(sliderVal) : sliderVal.toFixed(1);
            return (
              <div className="ql-expand" style={{ animation: 'qlSlideIn 0.25s cubic-bezier(0.22,1,0.36,1)' }}>
                {/* Header: type label + cancel */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 18 }}>{activeItem?.e || '🍼'}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.s }}>{activeItem?.l || quickFeedType}</span>
                  </div>
                  <div
                    onClick={closeQL}
                    style={{
                      fontSize: 12, fontWeight: 700, color: C.p, cursor: 'pointer',
                      padding: '5px 14px', borderRadius: 20, background: C.pl,
                      border: '1px solid ' + C.p + '44',
                    }}
                  >
                    Cancel
                  </div>
                </div>

                {/* Presets grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                  {presets.map((v) => (
                    <div
                      key={v}
                      className="ql-btn"
                      onClick={() => logAmount(v)}
                      style={{
                        padding: '7px 4px', textAlign: 'center', cursor: 'pointer',
                        background: C.bg, borderRadius: 10, border: '1px solid ' + C.b,
                      }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 800, color: C.t }}>{v}</div>
                      <div style={{ fontSize: 8, color: C.tl }}>{unit}</div>
                    </div>
                  ))}
                </div>

                {/* Inline slider + log button — always visible */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <input
                    type="range"
                    min={0}
                    max={sliderMax}
                    step={sliderStep}
                    value={sliderVal}
                    onChange={(e) => setSliderVal(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: C.s, height: 6 }}
                  />
                  <div
                    onClick={() => logAmount(isMl ? Math.round(sliderVal) : parseFloat(sliderVal.toFixed(1)))}
                    style={{
                      padding: '7px 14px', borderRadius: 10, whiteSpace: 'nowrap',
                      background: C.s, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
                    }}
                  >
                    {displayVal} {unit}
                  </div>
                </div>
              </div>
            );
          }

          // ─── Active timer view (feed timer or sleeping) ───
          if (hasActiveTimer) {
            return (
              <div style={{ animation: 'qlFadeScale 0.3s cubic-bezier(0.22,1,0.36,1)' }}>
                {/* Timer header: emoji + label + elapsed + actions */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 14,
                  background: isLong ? C.wl : timerBgColor,
                  border: isLong ? '1px solid ' + C.w + '66' : '1px solid ' + timerColor + '33',
                  marginBottom: 10,
                }}>
                  <div style={{ fontSize: 22 }}>{timerEmoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isLong ? C.w : timerColor }}>{timerLabel}</div>
                    <div style={{ fontSize: 10, color: C.tl }}>since {timerSince}</div>
                    {isLong && (
                      <div style={{ fontSize: 9, color: C.w, fontWeight: 600, marginTop: 1 }}>
                        Still going? Tap Done if finished
                      </div>
                    )}
                  </div>
                  {feedTimer && (
                    <div style={{
                      fontSize: 20, fontWeight: 800, color: isLong ? C.w : C.a,
                      fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign: 'center',
                    }}>
                      {Math.floor(feedElapsed / 60)}:{String(feedElapsed % 60).padStart(2, '0')}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 5 }}>
                    <div
                      onClick={feedTimer ? stopFeedTimer : () => quickLog('sleep', { type: 'Wake Up' }, 'Wake Up')}
                      style={{
                        padding: '6px 12px', borderRadius: 10,
                        background: timerColor, color: '#fff',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {feedTimer ? 'Done' : 'Wake'}
                    </div>
                    <div
                      onClick={feedTimer ? cancelFeedTimer : () => quickLog('sleep', { type: 'Wake Up' }, 'Wake Up')}
                      style={{
                        padding: '6px 10px', borderRadius: 10,
                        background: C.pl, color: C.p,
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        border: '1px solid ' + C.p + '44',
                        display: feedTimer ? 'block' : 'none',
                      }}
                    >
                      Cancel
                    </div>
                  </div>
                </div>

                {/* Companion items — things you can still log */}
                {companionItems.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: C.tl, fontWeight: 600, marginBottom: 5 }}>
                      Also log
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {companionItems.map((c) => (
                        <div
                          key={c.l}
                          className={'ql-btn' + (flashBtn === c.l ? ' ql-flash' : '')}
                          onClick={() => c.fn()}
                          style={{
                            flex: 1, textAlign: 'center', padding: '8px 4px',
                            borderRadius: 12, background: C.bg, border: '1px solid ' + C.b,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: 16 }}>{c.e}</div>
                          <div style={{ fontSize: 9, color: C.tl, marginTop: 2, fontWeight: 600 }}>{c.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // ─── Resume prompt (recent timed feed within 30 min, no timer) ───
          const timedTypes = ['Breast L', 'Breast R', 'Tummy Time'];
          const resumeFeedRaw = !feedTimer ? getRecentFeed(null) : null;
          const resumeFeed = resumeFeedRaw && timedTypes.includes(resumeFeedRaw.type) ? resumeFeedRaw : null;
          const showResume = !!resumeFeed;
          const resumeElapsed = resumeFeed?.mins || 0;

          // ─── Normal 4-column grid OR inline info panel ───
          return (
            <>
              {!qlInfoPanel && showResume && resumeFeed && (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 10px', marginBottom: 8, borderRadius: 10,
                    background: C.al, border: '1px solid ' + C.a + '33',
                    animation: 'fadeIn 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13 }}>🍼</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.a }}>
                      {resumeFeed.type} • {resumeElapsed > 0 ? resumeElapsed + 'm' : fmtTime(resumeFeed.time)}
                    </span>
                    <span style={{ fontSize: 9, color: C.tl }}>— continue?</span>
                  </div>
                  <div
                    onClick={() => startFeedTimer(resumeFeed.type)}
                    style={{
                      padding: '4px 10px', borderRadius: 8, flexShrink: 0,
                      background: C.a, color: '#fff',
                      fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Resume
                  </div>
                </div>
              )}

              {/* ─── Inline info panel (replaces grid on long-press) ─── */}
              {qlInfoPanel ? (
                <div style={{ animation: 'fadeIn 0.15s ease' }}>
                  {/* Header with icon + label + close */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 18 }}>{qlInfoPanel.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.t }}>{qlInfoPanel.label}</span>
                    </div>
                    <div
                      onClick={() => setQlInfoPanel(null)}
                      style={{
                        width: 24, height: 24, borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: C.bg, cursor: 'pointer', fontSize: 12, color: C.tl,
                        border: '1px solid ' + C.b,
                      }}
                    >
                      ✕
                    </div>
                  </div>

                  {/* Warning reason if highlighted */}
                  {qlInfoPanel.warn && (
                    <div style={{
                      padding: '8px 10px', borderRadius: 10, marginBottom: 10,
                      background: qlInfoPanel.warn.level === 'danger' ? 'rgba(220,38,38,0.08)' : 'rgba(245,158,11,0.08)',
                      border: '1px solid ' + (qlInfoPanel.warn.level === 'danger' ? 'rgba(220,38,38,0.25)' : 'rgba(245,158,11,0.25)'),
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: qlInfoPanel.warn.level === 'danger' ? '#dc2626' : '#d97706', marginBottom: 2 }}>
                        {qlInfoPanel.warn.level === 'danger' ? '⚠️ Needs attention' : '🔔 Heads up'}
                      </div>
                      <div style={{ fontSize: 11, color: C.t, lineHeight: 1.4 }}>{qlInfoPanel.warn.reason}</div>
                    </div>
                  )}

                  {/* Tips */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.tl, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Good to know</div>
                    {qlInfoPanel.tips.map((tip, i) => (
                      <div key={i} style={{ fontSize: 11, color: C.t, lineHeight: 1.45, padding: '2px 0', display: 'flex', gap: 5 }}>
                        <span style={{ color: C.a, flexShrink: 0 }}>•</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>

                  {/* Default amount setting (Formula / Pumped) */}
                  {qlInfoPanel.settingKey && (() => {
                    const sk = qlInfoPanel.settingKey!;
                    const isMl2 = volumeUnit === 'ml';
                    const presets2 = isMl2 ? [30, 60, 90, 120, 150, 180] : [1, 2, 3, 4, 5, 6];
                    const unit2 = volLabel(volumeUnit);
                    const current = qlDefaults[sk];
                    return (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: C.tl, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                          Default amount {current ? `· ${current} ${unit2}` : '· not set'}
                        </div>
                        <div style={{ fontSize: 10, color: C.tl, marginBottom: 6, lineHeight: 1.3 }}>
                          Set a default so each tap logs instantly
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {presets2.map((v) => (
                            <div
                              key={v}
                              onClick={() => { saveQlDefault(sk, v); }}
                              style={{
                                padding: '5px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                                cursor: 'pointer', userSelect: 'none',
                                background: current === v ? C.s + '20' : C.bg,
                                color: current === v ? C.s : C.tl,
                                border: '1px solid ' + (current === v ? C.s + '40' : C.b),
                              }}
                            >
                              {v} {unit2}
                            </div>
                          ))}
                          {current && (
                            <div
                              onClick={() => { saveQlDefault(sk, null); }}
                              style={{
                                padding: '5px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                                cursor: 'pointer', userSelect: 'none',
                                background: 'rgba(220,38,38,0.06)', color: '#dc2626',
                                border: '1px solid rgba(220,38,38,0.2)',
                              }}
                            >
                              Clear
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Recent history */}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.tl, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Recent</div>
                    {qlInfoPanel.history.length === 0 ? (
                      <div style={{ fontSize: 11, color: C.tl, fontStyle: 'italic', padding: '4px 0' }}>No entries yet</div>
                    ) : (
                      qlInfoPanel.history.map((entry, i) => (
                        <div key={entry.id || i} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '5px 0', borderBottom: i < qlInfoPanel.history.length - 1 ? '1px solid ' + C.b : 'none',
                        }}>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.t }}>{entry.type}</span>
                            {entry.amount && <span style={{ fontSize: 10, color: C.tl, marginLeft: 4 }}>{entry.amount}</span>}
                            {entry.oz && <span style={{ fontSize: 10, color: C.tl, marginLeft: 4 }}>{entry.oz}oz</span>}
                            {entry.mins && <span style={{ fontSize: 10, color: C.tl, marginLeft: 4 }}>{entry.mins}min</span>}
                          </div>
                          <div style={{ fontSize: 9, color: C.tl }}>{entry.date === today() ? entry.time : entry.date + ' ' + entry.time}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5 }}>
                  {qlItems.map((q: any) => {
                    const warnInfo = quickLogWarnings[q.l] || null;
                    const warn = warnInfo?.level || null;
                    const warnBg = warn === 'danger' ? 'rgba(220,38,38,0.10)' : warn === 'warn' ? 'rgba(245,158,11,0.10)' : null;
                    const warnBorder = warn === 'danger' ? 'rgba(220,38,38,0.4)' : warn === 'warn' ? 'rgba(245,158,11,0.4)' : null;
                    const warnText = warn === 'danger' ? '#dc2626' : warn === 'warn' ? '#d97706' : null;
                    return (
                      <div
                        key={q.l}
                        className={'ql-btn' + (q.dis ? ' ql-dis' : '') + (flashBtn === q.l ? ' ql-flash' : '') + (warn === 'danger' ? ' ql-danger' : '')}
                        onClick={q.dis ? undefined : () => { if (longPressTriggered.current) { longPressTriggered.current = false; return; } q.fn(); }}
                        onTouchStart={() => startLongPress(q.l, q.e)}
                        onTouchEnd={() => { clearLongPress(); }}
                        onTouchCancel={() => { clearLongPress(); longPressTriggered.current = false; }}
                        onContextMenu={(e: React.MouseEvent) => { e.preventDefault(); if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } longPressTriggered.current = true; const info = qlCategoryInfo[q.l]; if (info) { const warnInfo2 = quickLogWarnings[q.l] || null; const entries = logs[info.cat] || []; const history = entries.filter((e2: any) => info.types.includes(e2.type) || (e2.sides && info.types.some((t: string) => e2.sides.includes(t)))).slice(0, 5); setQlInfoPanel({ label: q.l, emoji: q.e, warn: warnInfo2, cat: info.cat, types: info.types, history, tips: info.tips, settingKey: info.settingKey }); } }}
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
              )}
            </>
          );
        })()}
      </Cd>

      {/* ═══ MOM WELLNESS — postpartum self-care tracker ═══ */}
      <div style={reveal(3)}>
      <MomCare />

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

      </div>

      {/* ═══ VOICE LOG BUTTON ═══ */}
      <VoiceButton quickLog={quickLog} babyName={babyName} />


    </div>
  );
}
