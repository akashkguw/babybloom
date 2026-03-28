import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { C } from '@/lib/constants/colors';
import type { CountryConfig } from '@/lib/constants/countries';

interface WelcomeSlide {
  icon: string;
  bg: string;
  title: string;
  desc: string;
  p0?: boolean;
  visual?: React.ReactNode;
  heroSlide?: boolean;
}

interface WelcomeCarouselProps {
  countryConfig: CountryConfig;
  babyName: string;
  onDismiss: () => void;
}

/* ── Inject carousel-specific keyframes once ── */
const STYLE_ID = 'bb-onboard-anims';
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes obSlideIn {
      from { opacity:0; transform:translateX(40px); }
      to   { opacity:1; transform:translateX(0); }
    }
    @keyframes obSlideOut {
      from { opacity:1; transform:translateX(0); }
      to   { opacity:0; transform:translateX(-40px); }
    }
    @keyframes obSlideInRev {
      from { opacity:0; transform:translateX(-40px); }
      to   { opacity:1; transform:translateX(0); }
    }
    @keyframes obSlideOutRev {
      from { opacity:1; transform:translateX(0); }
      to   { opacity:0; transform:translateX(40px); }
    }
    @keyframes obFadeUp {
      from { opacity:0; transform:translateY(16px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes obScaleIn {
      from { opacity:0; transform:scale(0.8); }
      to   { opacity:1; transform:scale(1); }
    }
    @keyframes obIconFloat {
      0%,100% { transform:translateY(0); }
      50% { transform:translateY(-6px); }
    }
    @keyframes obPulseGlow {
      0%,100% { box-shadow:0 0 0 0 rgba(255,107,138,0.3); }
      50% { box-shadow:0 0 0 12px rgba(255,107,138,0); }
    }
    @keyframes obDismissFade {
      from { opacity:1; transform:scale(1); }
      to   { opacity:0; transform:scale(1.05); }
    }
    @keyframes obConfettiDrift {
      0%   { opacity:1; transform:translateY(0) rotate(0deg) scale(1); }
      100% { opacity:0; transform:translateY(120vh) rotate(720deg) scale(0.5); }
    }
    @keyframes obDemoPulse {
      0%,100% { border-color:rgba(220,38,38,0.5); background:rgba(220,38,38,0.10); }
      50% { border-color:rgba(220,38,38,0.8); background:rgba(220,38,38,0.18); }
    }
    @keyframes obDemoAmber {
      0%,100% { border-color:rgba(245,158,11,0.5); background:rgba(245,158,11,0.10); }
      50% { border-color:rgba(245,158,11,0.8); background:rgba(245,158,11,0.18); }
    }
    @keyframes obTimerTick {
      0%,100% { opacity:1; }
      50% { opacity:0.4; }
    }
    @keyframes obHeroScale {
      0%   { opacity:0; transform:scale(0.6); filter:blur(8px); }
      60%  { opacity:1; transform:scale(1.04); filter:blur(0); }
      100% { opacity:1; transform:scale(1); filter:blur(0); }
    }
    @keyframes obTextReveal {
      from { opacity:0; transform:translateY(24px); filter:blur(4px); }
      to   { opacity:1; transform:translateY(0); filter:blur(0); }
    }
    @keyframes obGlow {
      0%,100% { box-shadow:0 0 40px rgba(255,107,138,0.15), 0 0 80px rgba(139,131,255,0.08); }
      50%     { box-shadow:0 0 60px rgba(255,107,138,0.30), 0 0 120px rgba(139,131,255,0.15); }
    }
    @keyframes obShimmer {
      from { background-position: -200% center; }
      to   { background-position: 200% center; }
    }
    @keyframes obBreatheDot {
      0%,100% { transform:scale(1); opacity:0.5; }
      50% { transform:scale(1.8); opacity:0.15; }
    }
    @keyframes obCursorTap {
      0%   { opacity:0; transform:translate(0, -12px) scale(0.7); }
      15%  { opacity:1; transform:translate(0, 0) scale(1); }
      30%  { transform:translate(0, 0) scale(0.8); opacity:1; }
      40%  { transform:translate(0, 0) scale(1); opacity:1; }
      55%  { opacity:1; }
      70%  { opacity:0; transform:translate(0, 4px) scale(0.9); }
      100% { opacity:0; transform:translate(0, 4px) scale(0.9); }
    }
    @keyframes obLongPressRing {
      0%   { stroke-dasharray:0 100; opacity:1; }
      70%  { stroke-dasharray:100 0; opacity:1; }
      85%  { stroke-dasharray:100 0; opacity:0.5; }
      100% { stroke-dasharray:100 0; opacity:0; }
    }
    @keyframes obHoldDown {
      0%   { opacity:0; transform:translate(0, -10px) scale(0.7); }
      12%  { opacity:1; transform:translate(0, 0) scale(1); }
      20%  { transform:translate(0, 2px) scale(0.92); opacity:1; }
      70%  { transform:translate(0, 2px) scale(0.92); opacity:1; }
      80%  { transform:translate(0, 0) scale(1); opacity:0.8; }
      90%  { opacity:0; transform:translate(0, -4px) scale(0.8); }
      100% { opacity:0; transform:translate(0, -4px) scale(0.8); }
    }
    @keyframes obHoldLabel {
      0%   { opacity:0; transform:translateY(4px); }
      15%  { opacity:1; transform:translateY(0); }
      70%  { opacity:1; transform:translateY(0); }
      85%  { opacity:0; transform:translateY(-2px); }
      100% { opacity:0; }
    }
    @keyframes obInfoSlideUp {
      from { opacity:0; transform:translateY(10px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes obTapHint {
      0%,100% { transform:translate(-50%,-30%) scale(1); opacity:0.9; }
      40% { transform:translate(-50%,-30%) scale(0.85); opacity:1; }
      50% { transform:translate(-50%,-30%) scale(0.85); opacity:1; }
      60% { transform:translate(-50%,-30%) scale(1); opacity:0.9; }
    }
    @keyframes obRipple {
      0% { transform:translate(-50%,-50%) scale(0.5); opacity:0.5; }
      50% { transform:translate(-50%,-50%) scale(1.8); opacity:0.15; }
      100% { transform:translate(-50%,-50%) scale(2.5); opacity:0; }
    }
  `;
  document.head.appendChild(s);
}

/* ── Animated tap cursor — shows a finger icon tapping on a target position ── */
function TapCursor({ visible, offsetX, offsetY, delay }: { visible: boolean; offsetX?: number; offsetY?: number; delay?: number }) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'absolute',
      left: offsetX ?? '50%', top: offsetY ?? '50%',
      zIndex: 10, pointerEvents: 'none',
      animation: `obCursorTap 1.8s ${delay ?? 0}s ease-in-out infinite`,
      fontSize: 18, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
    }}>
      👆
    </div>
  );
}

/* ── Long-press cursor — finger presses DOWN and HOLDS with a filling ring + "Hold" label ── */
function LongPressCursor({ visible, offsetX, offsetY, delay }: { visible: boolean; offsetX?: number; offsetY?: number; delay?: number }) {
  if (!visible) return null;
  const d = delay ?? 0;
  return (
    <div style={{
      position: 'absolute',
      left: offsetX ?? '50%', top: offsetY ?? '50%',
      zIndex: 10, pointerEvents: 'none',
      animation: `obHoldDown 3.2s ${d}s ease-in-out infinite`,
    }}>
      <div style={{ position: 'relative', width: 36, height: 36 }}>
        {/* Progress ring fills while finger is held down */}
        <svg width="36" height="36" viewBox="0 0 36 36" style={{ position: 'absolute', top: 0, left: 0 }}>
          <circle cx="18" cy="18" r="16" fill="none" stroke={C.a} strokeWidth="2"
            strokeDasharray="0 100" strokeLinecap="round" opacity="0.25"
            transform="rotate(-90 18 18)"
          />
          <circle cx="18" cy="18" r="16" fill="none" stroke={C.a} strokeWidth="2.5"
            strokeDasharray="0 100" strokeLinecap="round"
            transform="rotate(-90 18 18)"
            style={{ animation: `obLongPressRing 3.2s ${d}s ease-in-out infinite` }}
          />
        </svg>
        {/* Finger icon — pressed down */}
        <span style={{
          position: 'absolute', top: 7, left: 9, fontSize: 18,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
        }}>👇</span>
      </div>
      {/* "Hold" label below the finger */}
      <div style={{
        position: 'absolute', top: 38, left: '50%', transform: 'translateX(-50%)',
        fontSize: 8, fontWeight: 700, color: C.a, whiteSpace: 'nowrap',
        animation: `obHoldLabel 3.2s ${d}s ease-in-out infinite`,
        textShadow: `0 0 4px ${C.bg}`,
      }}>
        Hold
      </div>
    </div>
  );
}

/* ── Mini mock button — non-interactive, animation only ── */
function MockBtn({ emoji, label, border, bg, color, anim, flash }: {
  emoji: string; label: string; border?: string; bg?: string; color?: string;
  anim?: string; flash?: boolean;
}) {
  return (
    <div
      style={{
        textAlign: 'center', padding: '6px 2px', borderRadius: 10,
        background: bg || C.bg,
        border: flash ? `1.5px solid ${C.ok}` : `1px solid ${border || C.b}`,
        flex: 1, minWidth: 0, cursor: 'default',
        animation: anim || 'none',
        boxShadow: flash ? `0 0 8px ${C.ok}44` : 'none',
        transition: 'all 0.4s ease',
      }}
    >
      <div style={{ fontSize: 16 }}>{emoji}</div>
      <div style={{ fontSize: 8, color: color || C.tl, marginTop: 1, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

/* ── Auto-animated Quick Log demo — simplified: tap → flash → toast, then long-press → info ── */
function MiniDemo() {
  const [phase, setPhase] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // Simplified 3-phase demo:
  // 0: idle (Wet glowing red) — cursor taps Wet
  // 1: Wet flashes — toast shows "Wet logged!"
  // 2: cursor long-presses Nurse Left — info panel slides up
  // 3: info panel visible
  // 4: reset
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const times = [2200, 1600, 2000, 2400, 1400]; // ms per phase
    const cycle = () => {
      setPhase((p) => {
        const next = (p + 1) % 5;
        if (next === 1) { setToast('💧 Wet — logged!'); setShowInfo(false); }
        if (next === 2) { setToast(null); }
        if (next === 3) { setShowInfo(true); }
        if (next === 4) { setShowInfo(false); setToast(null); }
        if (next === 0) { setShowInfo(false); setToast(null); }
        t = setTimeout(cycle, times[next]);
        return next;
      });
    };
    t = setTimeout(cycle, times[0]);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ maxWidth: 300, margin: '16px auto 0' }}>
      <div style={{
        background: C.cd, borderRadius: 16, padding: '12px 10px 10px',
        border: `1px solid ${C.b}`, boxShadow: `0 4px 16px rgba(0,0,0,0.08)`,
        animation: 'obScaleIn 0.5s 0.2s both', position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, padding: '0 2px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.t }}>Quick Log</span>
          <span style={{ fontSize: 8, color: C.tl }}>Hold for details</span>
        </div>

        {showInfo ? (
          /* ── Long-press info panel demo ── */
          <div style={{
            padding: '10px', borderRadius: 12,
            background: C.bg, border: `1px solid ${C.a}30`,
            animation: 'obInfoSlideUp 0.35s ease-out',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>🤱</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.t }}>Nurse Left</span>
            </div>
            <div style={{ fontSize: 8, color: C.tl, lineHeight: 1.6, marginBottom: 6 }}>
              Last: 2h ago · Today: 4 feeds
            </div>
            <div style={{ fontSize: 8, color: C.a, fontWeight: 600 }}>
              💡 Alternate sides each feed for balanced supply
            </div>
          </div>
        ) : (
          /* ── Button grid ── */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <MockBtn emoji="🤱" label="Nurse Left" />
              <LongPressCursor visible={phase === 2} offsetX={20} offsetY={4} />
            </div>
            <MockBtn emoji="🍼" label="Formula" />
            <div style={{ position: 'relative' }}>
              <MockBtn emoji="💧" label="Wet"
                border={phase === 0 ? 'rgba(220,38,38,0.5)' : undefined}
                bg={phase === 0 ? 'rgba(220,38,38,0.10)' : undefined}
                color={phase === 0 ? '#dc2626' : undefined}
                anim={phase === 0 ? 'obDemoPulse 2s ease-in-out infinite' : undefined}
                flash={phase === 1}
              />
              <TapCursor visible={phase === 0} offsetX={20} offsetY={4} />
            </div>
            <MockBtn emoji="😴" label="Sleep"
              border={phase < 2 ? 'rgba(245,158,11,0.5)' : undefined}
              bg={phase < 2 ? 'rgba(245,158,11,0.10)' : undefined}
              color={phase < 2 ? '#d97706' : undefined}
              anim={phase < 2 ? 'obDemoAmber 2.5s ease-in-out infinite' : undefined}
            />
          </div>
        )}

        {/* Legend */}
        {!showInfo && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '0 2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: '#dc2626', animation: 'obDemoPulse 2s ease-in-out infinite' }} />
              <span style={{ fontSize: 7, color: '#dc2626', fontWeight: 700 }}>Needs attention</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: '#d97706', animation: 'obDemoAmber 2.5s ease-in-out infinite' }} />
              <span style={{ fontSize: 7, color: '#d97706', fontWeight: 700 }}>Due soon</span>
            </div>
          </div>
        )}
      </div>

      {/* Animated toast */}
      {toast && (
        <div style={{
          marginTop: 6, padding: '5px 10px', borderRadius: 10,
          background: C.okl, border: `1px solid ${C.ok}33`,
          fontSize: 9, fontWeight: 700, color: C.ok, textAlign: 'center',
          animation: 'obFadeUp 0.2s ease-out',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Confetti particle ── */
function Confetti() {
  const particles = useRef(
    Array.from({ length: 24 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.5 + Math.random() * 1.5,
      color: [C.p, C.s, C.a, C.w, C.pu, '#FFD700', '#FF6B6B', '#00E5FF'][i % 8],
      size: 6 + Math.random() * 6,
      rot: Math.random() * 360,
    }))
  ).current;
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10001, overflow: 'hidden' }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', top: -20, left: p.left + '%',
          width: p.size, height: p.size,
          borderRadius: p.size > 9 ? 2 : '50%',
          background: p.color,
          animation: `obConfettiDrift ${p.dur}s ${p.delay}s ease-out forwards`,
          transform: `rotate(${p.rot}deg)`,
        }} />
      ))}
    </div>
  );
}

/* ── Auto-animated Mom Wellness demo — matches production layout ── */
function MomWellnessDemo() {
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Matches prod: 4 meals (inc. snack), water boolean, sleep quality, mood, vitamin, moved
  const sequence = useMemo(() => [
    { meals: {}, water: false, sleep: 0 as number, mood: 0, vitamin: false, moved: false, toast: null, expand: false, tapTarget: null as string | null },
    { meals: {}, water: false, sleep: 0, mood: 0, vitamin: false, moved: false, toast: null, expand: true, tapTarget: null }, // expand
    { meals: { breakfast: true }, water: false, sleep: 0, mood: 0, vitamin: false, moved: false, toast: '🥣 Bfast ✓', expand: true, tapTarget: 'bfast' },
    { meals: { breakfast: true, lunch: true }, water: false, sleep: 0, mood: 0, vitamin: false, moved: false, toast: '🥗 Lunch ✓', expand: true, tapTarget: 'lunch' },
    { meals: { breakfast: true, lunch: true }, water: true, sleep: 0, mood: 0, vitamin: false, moved: false, toast: '💧 Water ✓', expand: true, tapTarget: 'water' },
    { meals: { breakfast: true, lunch: true }, water: true, sleep: 3, mood: 0, vitamin: false, moved: false, toast: '🌕 Slept well!', expand: true, tapTarget: 'sleep' },
    { meals: { breakfast: true, lunch: true }, water: true, sleep: 3, mood: 4, vitamin: false, moved: false, toast: '☀️ Feeling good', expand: true, tapTarget: 'mood' },
    { meals: { breakfast: true, lunch: true }, water: true, sleep: 3, mood: 4, vitamin: true, moved: false, toast: '💊 Vitamin ✓', expand: true, tapTarget: 'vitamin' },
    { meals: { breakfast: true, lunch: true }, water: true, sleep: 3, mood: 4, vitamin: true, moved: true, toast: '🧘 Movement ✓', expand: true, tapTarget: 'moved' },
    { meals: {}, water: false, sleep: 0, mood: 0, vitamin: false, moved: false, toast: null, expand: false, tapTarget: null }, // reset
  ], []);

  useEffect(() => {
    let s = 0;
    const advance = () => {
      s = (s + 1) % sequence.length;
      setStep(s);
      const item = sequence[s];
      setExpanded(item.expand);
      if (item.toast) {
        setToast(item.toast);
        setTimeout(() => setToast(null), 1200);
      }
    };
    const timer = setInterval(advance, 1600);
    return () => clearInterval(timer);
  }, [sequence]);

  const cur = sequence[step];
  const mealItems = [
    { key: 'breakfast', icon: '🥣', label: 'Bfast' },
    { key: 'lunch', icon: '🥗', label: 'Lunch' },
    { key: 'dinner', icon: '🍲', label: 'Dinner' },
    { key: 'snack', icon: '🥜', label: 'Snack' },
  ];
  const moods = ['🥀', '🌥️', '🌤️', '☀️', '✨'];
  const sleepLabels = ['', '🌑 Poor', '🌓 OK', '🌕 Good'];

  const mealsCount = Object.values(cur.meals).filter(Boolean).length;
  const totalDone = mealsCount + (cur.water ? 1 : 0) + (cur.sleep > 0 ? 1 : 0)
    + (cur.mood > 0 ? 1 : 0) + (cur.vitamin ? 1 : 0) + (cur.moved ? 1 : 0);
  const maxChecks = 9; // meals(4), water(1), vitamin(1), sleep(1), mood(1), moved(1)
  const progress = Math.min(Math.round((totalDone / maxChecks) * 100), 100);

  const pillStyle = (active: boolean, clr: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '4px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
    flex: 1, userSelect: 'none',
    background: active ? clr + '20' : C.bg + '80',
    color: active ? clr : C.tl,
    border: `1px solid ${active ? clr + '40' : C.b}`,
    transition: 'all 0.4s ease',
  });

  return (
    <div style={{ maxWidth: 300, margin: '14px auto 0' }}>
      <div style={{
        background: C.cd, borderRadius: 20, padding: '14px 16px',
        border: `1px solid ${C.b}`, boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        animation: 'obScaleIn 0.5s 0.2s both',
      }}>
        {/* Header — matches prod with expand chevron */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? 10 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🌿</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.t }}>My Wellness</span>
            {!expanded && (
              <span style={{ fontSize: 11, color: C.tl, fontWeight: 500, transition: 'opacity 0.3s' }}>
                {mealsCount}/4 meals{cur.mood > 0 ? ` · ${moods[cur.mood - 1]}` : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Progress ring */}
            <svg width="22" height="22" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke={C.b} strokeWidth="2.5" />
              <circle cx="12" cy="12" r="10" fill="none"
                stroke={progress >= 100 ? '#4CAF50' : '#9C7CF4'}
                strokeWidth="2.5"
                strokeDasharray={`${(progress / 100) * 62.8} 62.8`}
                strokeLinecap="round"
                transform="rotate(-90 12 12)"
                style={{ transition: 'stroke-dasharray 0.4s ease' }}
              />
              <text x="12" y="12" textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: 7, fontWeight: 700, fill: C.t }}>
                {progress}%
              </text>
            </svg>
            <span style={{ fontSize: 12, color: C.tl, transition: 'transform 0.3s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
          </div>
        </div>

        {expanded && (
          <div style={{ animation: 'obFadeUp 0.3s ease-out' }}>
            {/* Meals row — 4 items like prod */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.tl, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Meals</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {mealItems.map((m) => (
                  <div key={m.key} style={pillStyle(!!(cur.meals as Record<string, boolean>)[m.key], '#FF8A65')}>
                    {m.icon} {m.label}{(cur.meals as Record<string, boolean>)[m.key] ? ' ✓' : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Sleep quality — matches prod: 3-state cycle */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.tl, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Sleep</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3].map((val) => (
                  <div key={val} style={pillStyle(cur.sleep === val, '#7E57C2')}>
                    {sleepLabels[val]}
                  </div>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.tl, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>How are you feeling?</div>
              <div style={{ display: 'flex', gap: 3 }}>
                {moods.map((face, i) => (
                  <div key={i} style={{
                    flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: 10, fontSize: 16,
                    userSelect: 'none',
                    background: cur.mood === i + 1 ? '#9C7CF420' : 'transparent',
                    border: `1.5px solid ${cur.mood === i + 1 ? '#9C7CF4' : 'transparent'}`,
                    transition: 'all 0.4s ease',
                  }}>{face}</div>
                ))}
              </div>
            </div>

            {/* Quick toggles — water + vitamin + moved */}
            <div style={{ display: 'flex', gap: 4 }}>
              <div style={pillStyle(cur.water, '#29B6F6')}>
                💧 Water{cur.water ? ' ✓' : ''}
              </div>
              <div style={pillStyle(cur.vitamin, '#AB47BC')}>
                💊 Vitamin{cur.vitamin ? ' ✓' : ''}
              </div>
              <div style={pillStyle(cur.moved, '#66BB6A')}>
                🧘 Moved{cur.moved ? ' ✓' : ''}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          marginTop: 6, padding: '5px 10px', borderRadius: 10,
          background: C.okl, border: `1px solid ${C.ok}33`,
          fontSize: 9, fontWeight: 700, color: C.ok, textAlign: 'center',
          animation: 'obFadeUp 0.2s ease-out',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

export default function WelcomeCarousel({ countryConfig, babyName, onDismiss }: WelcomeCarouselProps) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<'fwd' | 'rev'>('fwd');
  const [animKey, setAnimKey] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const name = babyName || 'your baby';

  useEffect(() => { ensureStyles(); }, []);

  const totalRef = useRef(7); // updated after slides defined

  const handleDismiss = useCallback(() => {
    setDismissing(true);
    setTimeout(() => onDismiss(), 600);
  }, [onDismiss]);

  const idxRef = useRef(0);
  idxRef.current = idx;

  const goNext = useCallback(() => {
    const cur = idxRef.current;
    if (cur < totalRef.current - 1) {
      setDir('fwd');
      setAnimKey((k) => k + 1);
      setIdx(cur + 1);
    } else {
      handleDismiss();
    }
  }, [handleDismiss]);

  /* ── Slide 1 visual: Interactive mini demo ── */
  const demoVisual = <MiniDemo />;

  /* ── Slide 3 visual: Safety toolkit ── */
  const safetyVisual = (
    <div style={{ maxWidth: 300, margin: '16px auto 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {[
        { icon: '💉', color: C.bl, bg: C.bll + '66', title: `${countryConfig.medical.authority} Vaccine Schedule`, sub: 'Alerts when doses are due — track what\'s done' },
        { icon: '🆘', color: C.p, bg: C.pl, title: `Emergency — ${countryConfig.emergency.primaryNumber}`, sub: 'One-tap call, CPR steps, choking guide — always offline' },
        { icon: '💊', color: C.pu, bg: C.pul, title: 'Medicine Dosing Calculator', sub: `${countryConfig.medicines.antipyretic.name} & ${countryConfig.medicines.antiInflammatory.name} — by weight` },
      ].map((item, i) => (
        <div key={i} style={{
          padding: '7px 10px', borderRadius: 10,
          borderLeft: `3px solid ${item.color}`, background: item.bg,
          display: 'flex', alignItems: 'center', gap: 6,
          animation: `obFadeUp 0.35s ${0.1 + i * 0.1}s both`,
        }}>
          <span style={{ fontSize: 13 }}>{item.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: item.color }}>{item.title}</div>
            <div style={{ fontSize: 8, color: C.t }}>{item.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );

  /* ── Slide 4 visual: Partner sync + Report + Stats + Privacy ── */
  const teamVisual = (
    <div style={{ maxWidth: 300, margin: '16px auto 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {[
        { icon: '👫', grad: `linear-gradient(135deg, ${C.s}, ${C.pu})`, title: 'Partner Sync', sub: 'Both parents see the same data — scan a QR code to link phones' },
        { icon: '📋', grad: `linear-gradient(135deg, ${C.a}, #00B4D8)`, title: 'Pediatrician Report', sub: 'One-tap summary of feeds, sleep, growth & vaccines — ready for the doctor' },
        { icon: '📊', grad: `linear-gradient(135deg, ${C.p}cc, #FF8FA3)`, title: 'Daily Stats', sub: 'Feeds, diapers, sleep hours — at a glance on your home screen' },
      ].map((item, i) => (
        <div key={i} style={{
          padding: '8px 10px', borderRadius: 10,
          background: C.cd, border: `1px solid ${C.b}`,
          display: 'flex', alignItems: 'center', gap: 8,
          animation: `obFadeUp 0.35s ${0.1 + i * 0.1}s both`,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: item.grad,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>{item.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.t }}>{item.title}</div>
            <div style={{ fontSize: 8, color: C.tl }}>{item.sub}</div>
          </div>
        </div>
      ))}
      <div style={{
        marginTop: 2, padding: '6px 10px', borderRadius: 10,
        background: C.okl, border: `1px solid ${C.ok}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        animation: 'obFadeUp 0.35s 0.4s both',
      }}>
        <span style={{ fontSize: 11 }}>🔒</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: C.ok }}>All data stored on your device — nothing leaves your phone</span>
      </div>
    </div>
  );

  /* ── Slide 5 visual: Mom Wellness interactive demo ── */
  const wellnessVisual = <MomWellnessDemo />;

  /* ── Slide 2 visual: Smart alerts ── */
  const alertsVisual = (
    <div style={{ maxWidth: 300, margin: '16px auto 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {[
        { icon: '🍼', color: C.p, bg: C.pl, title: 'Feed now', sub: 'No feed in 5h — longer than usual' },
        { icon: '💧', color: C.w, bg: C.wl, title: 'Check hydration', sub: 'Only 2 wet diapers today' },
        { icon: '💡', color: C.a, bg: C.al, title: 'Tummy time', sub: 'Great for neck strength — try 3-5 min today' },
      ].map((item, i) => (
        <div key={i} style={{
          padding: '7px 10px', borderRadius: 10,
          borderLeft: `3px solid ${item.color}`, background: item.bg,
          display: 'flex', alignItems: 'center', gap: 6,
          animation: `obFadeUp 0.35s ${0.1 + i * 0.1}s both`,
        }}>
          <span style={{ fontSize: 13 }}>{item.icon}</span>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: item.color }}>{item.title}</div>
            <div style={{ fontSize: 8, color: C.t }}>{item.sub}</div>
          </div>
        </div>
      ))}
      <div style={{ fontSize: 8, color: C.tl, textAlign: 'center', marginTop: 2, fontStyle: 'italic', animation: 'obFadeUp 0.3s 0.4s both' }}>
        Sorted by urgency — red first, green last
      </div>
    </div>
  );

  const slides: WelcomeSlide[] = [
    {
      icon: '⚡',
      bg: `linear-gradient(135deg, ${C.a}, #00B4D8)`,
      title: 'Welcome to BabyBloom',
      desc: `${countryConfig.medical.authority} guidelines & built-in timers. Buttons glow when ${name} needs attention — tap to log, hold for history & tips.`,
      visual: demoVisual,
      p0: true,
    },
    {
      icon: '🔔',
      bg: `linear-gradient(135deg, ${C.s}, ${C.pu})`,
      title: 'We Watch, You Rest',
      desc: `BabyBloom learns ${name}'s patterns and alerts you — feed gaps, low diapers, overdue vaccines. Priority-sorted so the urgent stuff is always first.`,
      visual: alertsVisual,
    },
    {
      icon: '🛡️',
      bg: `linear-gradient(135deg, #FF6B6B, ${C.p})`,
      title: 'Safety & Health Toolkit',
      desc: `Vaccines, emergency contacts, CPR, choking guide, and exact medicine doses — all offline, all ${countryConfig.name}-specific.`,
      visual: safetyVisual,
      p0: true,
    },
    {
      icon: '🌿',
      bg: `linear-gradient(135deg, #66BB6A, #26A69A)`,
      title: 'Your Wellness Matters',
      desc: 'Track meals, water, mood, sleep & vitamins — one-tap daily self-care that resets each morning.',
      visual: wellnessVisual,
    },
    {
      icon: '🤝',
      bg: `linear-gradient(135deg, ${C.s}, ${C.pu})`,
      title: 'Built for Your Team',
      desc: `Sync with your partner so both parents stay in the loop. Generate a pediatrician report before every visit — all from your logs.`,
      visual: teamVisual,
    },
    {
      icon: '',
      bg: `linear-gradient(135deg, ${C.p}, ${C.s} 50%, ${C.pu})`,
      title: '',
      desc: '',
      heroSlide: true,
    },
  ];

  const total = slides.length;
  totalRef.current = total;
  const isLast = idx === total - 1;
  const slide = slides[idx];
  const hasVisual = !!slide.visual;

  // Transition animation name based on direction
  const slideAnim = dir === 'fwd' ? 'obSlideIn' : 'obSlideInRev';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: C.bg,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      animation: dismissing ? 'obDismissFade 0.6s 0.3s ease-out forwards' : 'obFadeUp 0.4s ease-out',
    }}>
      {/* Skip button — hidden on final hero slide */}
      <div style={{
        padding: '12px 20px 0', display: 'flex', justifyContent: 'flex-end',
        animation: 'obFadeUp 0.3s 0.2s both',
        opacity: isLast ? 0 : 1, pointerEvents: isLast ? 'none' : 'auto',
        transition: 'opacity 0.3s',
      }}>
        <div
          onClick={handleDismiss}
          style={{
            fontSize: 12, color: C.tl, cursor: 'pointer', padding: '5px 14px',
            borderRadius: 20, background: 'transparent',
            transition: 'all 0.2s', fontWeight: 500,
          }}
        >
          Skip
        </div>
      </div>

      {/* Main swipeable area — keyed for re-animation */}
      <div
        key={animKey}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 24px',
          overflowY: 'auto',
          animation: `${slideAnim} 0.4s cubic-bezier(0.22,1,0.36,1)`,
        }}
      >
        {slide.heroSlide ? (
          /* ── Apple-style "Hello" final slide ── */
          <div style={{ textAlign: 'center', position: 'relative' }}>
            {/* Soft breathing glow */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 240, height: 240, borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, ${C.p}12 0%, ${C.s}08 50%, transparent 70%)`,
              animation: 'obGlow 5s ease-in-out infinite',
              pointerEvents: 'none',
            }} />

            {/* Hero bloom — gentle reveal */}
            <div style={{
              fontSize: 56, lineHeight: 1,
              animation: 'obHeroScale 1.2s cubic-bezier(0.22,1,0.36,1)',
              marginBottom: 28,
            }}>
              🌸
            </div>

            {/* "You're All Set" — soft gradient text */}
            <div style={{
              fontSize: 28, fontWeight: 700,
              background: `linear-gradient(135deg, ${C.p}, ${C.s})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'obTextReveal 0.9s 0.4s cubic-bezier(0.22,1,0.36,1) both',
              lineHeight: 1.3, marginBottom: 14, letterSpacing: -0.3,
            }}>
              You&apos;re All Set
            </div>

            {/* Body — warm, reassuring */}
            <p style={{
              fontSize: 14, color: C.tl, lineHeight: 1.75,
              maxWidth: 260, margin: '0 auto', fontWeight: 400,
              animation: 'obTextReveal 0.9s 0.7s cubic-bezier(0.22,1,0.36,1) both',
            }}>
              Every feed, every nap, every moment —<br />
              we&apos;re here with you.
            </p>
          </div>
        ) : (
          /* ── Standard slide layout ── */
          <>
            {/* Icon circle — floats gently */}
            <div style={{
              width: hasVisual ? 56 : 88, height: hasVisual ? 56 : 88,
              borderRadius: '50%', margin: `0 auto ${hasVisual ? 10 : 20}px`,
              background: slide.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 6px 20px ${C.p}18`,
              position: 'relative', flexShrink: 0,
              animation: `obIconFloat 4s ease-in-out infinite, obScaleIn 0.5s ease-out`,
            }}>
              <span style={{
                fontSize: hasVisual ? 24 : 38,
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
              }}>{slide.icon}</span>
              {slide.p0 && (
                <div style={{
                  position: 'absolute', top: hasVisual ? -2 : -2, right: hasVisual ? -4 : -4,
                  background: C.p, color: 'white', fontSize: 7, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 8, letterSpacing: 0.3,
                  boxShadow: `0 2px 6px ${C.p}40`,
                }}>
                  KEY
                </div>
              )}
            </div>

            {/* Title */}
            <h2 style={{
              fontSize: hasVisual ? 19 : 22, fontWeight: 700, color: C.t, textAlign: 'center',
              marginBottom: 8, lineHeight: 1.3, flexShrink: 0, letterSpacing: -0.3,
            }}>
              {slide.title}
            </h2>

            {/* Description */}
            <p style={{
              fontSize: 13, color: C.tl, textAlign: 'center', lineHeight: 1.7,
              maxWidth: 300, margin: '0 auto', flexShrink: 0, fontWeight: 400,
            }}>
              {slide.desc}
            </p>

            {/* Visual */}
            {slide.visual && (
              <div style={{ flexShrink: 0 }}>{slide.visual}</div>
            )}
          </>
        )}
      </div>

      {/* Bottom: dots + next */}
      <div style={{ padding: '0 28px 36px', flexShrink: 0 }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
          {slides.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === idx ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === idx ? C.p : i < idx ? C.p + '44' : `${C.t}15`,
                transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
              }}
            />
          ))}
        </div>

        {/* Continue / Get Started */}
        <div
          onClick={goNext}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 28, cursor: 'pointer',
            background: isLast ? C.p : C.p,
            color: 'white', fontSize: 15, fontWeight: 600,
            textAlign: 'center',
            letterSpacing: 0.2,
            boxShadow: `0 2px 10px ${C.p}20`,
            transition: 'all 0.3s',
          }}
        >
          {isLast ? 'Get Started' : 'Continue'}
        </div>
      </div>
    </div>
  );
}
