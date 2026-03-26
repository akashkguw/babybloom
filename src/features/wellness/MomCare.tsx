/**
 * MomCare — Postpartum mother wellness widget for the Home screen.
 *
 * Evidence-based daily self-care tracker following ACOG postpartum guidelines.
 * Tracks: meals, hydration, vitamins/iron, sleep quality, mood, and movement.
 * Persists daily state in IndexedDB (profile-scoped).
 *
 * Design principles: one-tap toggles, zero clutter, works one-handed,
 * resets automatically each day.
 */

import { useState, useEffect, useCallback } from 'react';
import { C } from '@/lib/constants/colors';
import { today } from '@/lib/utils/date';
import { dg, ds } from '@/lib/db';

// ─── Types ───────────────────────────────────────────────────────────
interface MomDay {
  date: string;
  meals: { breakfast: boolean; lunch: boolean; dinner: boolean; snack: boolean };
  water: boolean;
  vitamin: boolean;
  sleep: 0 | 1 | 2 | 3; // 0=not set, 1=poor, 2=ok, 3=good
  mood: 0 | 1 | 2 | 3 | 4 | 5; // 0=not set, 1-5 scale
  moved: boolean; // any exercise/walk
  note: string;
}

interface MomCareProps {
  storageKey?: string; // profile-scoped key prefix
}

const STORAGE_KEY = 'momcare_today';
const HISTORY_KEY = 'momcare_history';

const emptyDay = (d: string): MomDay => ({
  date: d,
  meals: { breakfast: false, lunch: false, dinner: false, snack: false },
  water: false,
  vitamin: false,
  sleep: 0,
  mood: 0,
  moved: false,
  note: '',
});

const MEAL_ICONS: Record<string, string> = {
  breakfast: '🥣',
  lunch: '🥗',
  dinner: '🍲',
  snack: '🥜',
};

const MOOD_FACES = ['', '🥀', '🌥️', '🌤️', '☀️', '✨'];
const MOOD_LABELS = ['', 'Rough', 'Meh', 'OK', 'Good', 'Great'];
const SLEEP_LABELS = ['', '🌑 Poor', '🌓 OK', '🌕 Good'];

export default function MomCare({ storageKey }: MomCareProps) {
  const key = storageKey ? `${storageKey}_${STORAGE_KEY}` : STORAGE_KEY;
  const td = today();
  const [data, setData] = useState<MomDay>(emptyDay(td));
  const [expanded, setExpanded] = useState(false);
  const [showNote, setShowNote] = useState(false);

  // Load today's data (reset if it's a new day)
  useEffect(() => {
    dg(key).then((saved: MomDay | null) => {
      if (saved && saved.date === td) {
        setData(saved);
      } else {
        setData(emptyDay(td));
      }
    });
  }, [key, td]);

  // Persist on every change + save to history
  const historyKey = storageKey ? `${storageKey}_${HISTORY_KEY}` : HISTORY_KEY;
  const save = useCallback(
    (updated: MomDay) => {
      setData(updated);
      ds(key, updated);
      // Save to history array for stats graphs
      dg(historyKey).then((history: MomDay[] | null) => {
        const arr = history || [];
        const idx = arr.findIndex((h) => h.date === updated.date);
        if (idx >= 0) {
          arr[idx] = updated;
        } else {
          arr.push(updated);
        }
        // Keep last 90 days
        const trimmed = arr.slice(-90);
        ds(historyKey, trimmed);
      });
    },
    [key, historyKey],
  );

  const toggleMeal = (meal: keyof MomDay['meals']) => {
    save({ ...data, meals: { ...data.meals, [meal]: !data.meals[meal] } });
  };

  const cycleSleep = () => {
    const next = ((data.sleep + 1) % 4) as 0 | 1 | 2 | 3;
    save({ ...data, sleep: next });
  };

  const setMood = (m: 0 | 1 | 2 | 3 | 4 | 5) => save({ ...data, mood: m });

  // ─── Progress calculation ──────────────────────────────────────
  const mealsCount = Object.values(data.meals).filter(Boolean).length;
  const totalChecks =
    mealsCount +
    (data.water ? 1 : 0) +
    (data.vitamin ? 1 : 0) +
    (data.sleep > 0 ? 1 : 0) +
    (data.mood > 0 ? 1 : 0) +
    (data.moved ? 1 : 0);
  const maxChecks = 9; // meals(4), water(1), vitamin(1), sleep(1), mood(1), moved(1)
  const progress = Math.min(Math.round((totalChecks / maxChecks) * 100), 100);

  // ─── Collapsed summary (always visible) ────────────────────────
  const pillStyle = (active: boolean, color?: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 8px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    background: active ? (color || C.a) + '20' : C.bg + '80',
    color: active ? color || C.a : C.tl,
    border: `1px solid ${active ? (color || C.a) + '40' : C.b}`,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    userSelect: 'none' as const,
    WebkitTapHighlightColor: 'transparent',
  });

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: C.tl,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  };

  return (
    <div
      style={{
        background: C.cd,
        borderRadius: 20,
        padding: '14px 16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        border: `1px solid ${C.b}`,
        marginBottom: 12,
      }}
    >
      {/* Header — always visible */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🌿</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.t }}>My Wellness</span>
          {!expanded && (
            <span style={{ fontSize: 11, color: C.tl, fontWeight: 500 }}>
              {mealsCount}/4 meals
              {data.mood > 0 ? ` · ${MOOD_FACES[data.mood]}` : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Progress ring */}
          <svg width="24" height="24" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke={C.b}
              strokeWidth="2.5"
            />
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke={progress >= 100 ? '#4CAF50' : '#9C7CF4'}
              strokeWidth="2.5"
              strokeDasharray={`${(progress / 100) * 62.8} 62.8`}
              strokeLinecap="round"
              transform="rotate(-90 12 12)"
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
            <text
              x="12"
              y="12"
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fontSize: 7, fontWeight: 700, fill: C.t }}
            >
              {progress}%
            </text>
          </svg>
          <span
            style={{
              fontSize: 14,
              color: C.tl,
              transition: 'transform 0.2s ease',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▾
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ── Meals ── */}
          <div>
            <div style={sectionLabel}>Meals</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Object.keys(data.meals) as (keyof MomDay['meals'])[]).map((meal) => (
                <div
                  key={meal}
                  onClick={() => toggleMeal(meal)}
                  style={pillStyle(data.meals[meal], '#FF8A65')}
                >
                  {MEAL_ICONS[meal]}{' '}
                  {meal.charAt(0).toUpperCase() + meal.slice(1)}
                  {data.meals[meal] && ' ✓'}
                </div>
              ))}
            </div>
          </div>

          {/* ── Quick toggles row: Water · Vitamin · Movement ── */}
          <div style={{ display: 'flex', gap: 6 }}>
            <div
              onClick={() => save({ ...data, water: !data.water })}
              style={{ ...pillStyle(data.water, '#4FC3F7'), flex: 1, justifyContent: 'center', padding: '8px 0' }}
            >
              💧 Water{data.water ? ' ✓' : ''}
            </div>
            <div
              onClick={() => save({ ...data, vitamin: !data.vitamin })}
              style={{ ...pillStyle(data.vitamin, '#AB47BC'), flex: 1, justifyContent: 'center', padding: '8px 0' }}
            >
              💊 Prenatal{data.vitamin ? ' ✓' : ''}
            </div>
            <div
              onClick={() => save({ ...data, moved: !data.moved })}
              style={{ ...pillStyle(data.moved, '#66BB6A'), flex: 1, justifyContent: 'center', padding: '8px 0' }}
            >
              🧘 Movement{data.moved ? ' ✓' : ''}
            </div>
          </div>

          {/* ── Sleep quality ── */}
          <div>
            <div style={sectionLabel}>Last night's sleep</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([1, 2, 3] as const).map((lvl) => (
                <div
                  key={lvl}
                  onClick={() => save({ ...data, sleep: data.sleep === lvl ? 0 : lvl })}
                  style={{
                    ...pillStyle(data.sleep === lvl, lvl === 1 ? '#EF5350' : lvl === 2 ? '#FFA726' : '#66BB6A'),
                    flex: 1,
                    justifyContent: 'center',
                    padding: '8px 0',
                  }}
                >
                  {SLEEP_LABELS[lvl]}
                </div>
              ))}
            </div>
          </div>

          {/* ── Mood ── */}
          <div>
            <div style={sectionLabel}>
              How are you feeling?
              {data.mood > 0 && (
                <span style={{ fontWeight: 400, textTransform: 'none' }}>
                  {' '} — {MOOD_LABELS[data.mood]}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
              {([1, 2, 3, 4, 5] as const).map((m) => (
                <div
                  key={m}
                  onClick={() => setMood(data.mood === m ? 0 : m)}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '6px 0',
                    borderRadius: 12,
                    fontSize: 20,
                    cursor: 'pointer',
                    background: data.mood === m ? '#9C7CF4' + '20' : 'transparent',
                    border: `1.5px solid ${data.mood === m ? '#9C7CF4' : 'transparent'}`,
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {MOOD_FACES[m]}
                </div>
              ))}
            </div>
          </div>

          {/* ── Optional note ── */}
          <div>
            {!showNote && !data.note ? (
              <div
                onClick={() => setShowNote(true)}
                style={{ fontSize: 11, color: C.tl, cursor: 'pointer', textAlign: 'center' }}
              >
                + Add a note
              </div>
            ) : (
              <textarea
                value={data.note}
                onChange={(e) => save({ ...data, note: e.target.value })}
                onBlur={() => { if (!data.note) setShowNote(false); }}
                placeholder="How's your day going? Any concerns?"
                autoFocus={showNote && !data.note}
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 12,
                  border: `1px solid ${C.b}`,
                  background: C.bg,
                  color: C.t,
                  fontSize: 12,
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          {/* ── Encouragement ── */}
          {progress >= 100 && (
            <div
              style={{
                textAlign: 'center',
                fontSize: 12,
                color: '#4CAF50',
                fontWeight: 600,
                padding: '4px 0',
              }}
            >
              You're taking great care of yourself today 💪
            </div>
          )}
        </div>
      )}
    </div>
  );
}
