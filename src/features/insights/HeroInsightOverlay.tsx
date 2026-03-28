/**
 * HeroInsightOverlay
 * Long-press the hero widget to reveal age-appropriate baby development insights.
 * Shows a beautiful animated overlay with milestone tips, fun facts, and development info.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { C } from '@/lib/constants/colors';
import { MILESTONES } from '@/lib/constants/milestones';
import { Icon as Ic } from '@/components/shared';

interface HeroInsightOverlayProps {
  age: number;       // baby age in months
  babyName: string;
  onClose: () => void;
}

/** Age-appropriate fun facts and tips beyond milestone data */
const FUN_FACTS: Record<number, string[]> = {
  0: [
    'Your newborn can recognize your voice from the womb!',
    'Babies are born with about 300 bones — more than adults.',
    'Newborns can only see about 8-12 inches away — perfect for seeing your face while feeding.',
    'A baby\'s stomach is only the size of a marble on day one.',
    'Skin-to-skin contact helps regulate baby\'s heartbeat and temperature.',
  ],
  1: [
    'By now, baby may start tracking objects with their eyes.',
    'Your baby already knows your smell and prefers it over all others.',
    'Babies this age sleep 14-17 hours a day (in short bursts!).',
    'Your voice is baby\'s favorite sound in the whole world.',
  ],
  2: [
    'Baby may start smiling socially — and it\'s not just gas!',
    'Tummy time helps build neck and shoulder muscles.',
    'Babies can now distinguish between different colors.',
    'Your baby\'s brain is growing about 1% every day.',
  ],
  3: [
    'Baby may start laughing out loud this month!',
    'Those little hands are learning to open and close on purpose.',
    'Baby can now hold their head steady — so strong!',
    'Your baby recognizes familiar faces and starts showing preferences.',
  ],
  4: [
    'Baby may start reaching for toys with purpose.',
    'Rolling from tummy to back could happen any day now!',
    'Your baby\'s vision is almost as sharp as an adult\'s.',
    'Babbling with vowel sounds like "ooh" and "aah" begins.',
  ],
  5: [
    'Baby might start sitting with support.',
    'Everything goes in the mouth — it\'s how they explore!',
    'Your baby can now recognize their own name.',
    'Peek-a-boo becomes the best game ever around now.',
  ],
  6: [
    'Solid food adventures may begin! Start with single ingredients.',
    'Baby can probably sit without support for short periods.',
    'Your baby may start showing stranger anxiety — totally normal.',
    'Sleep patterns often consolidate around this age.',
  ],
  8: [
    'Crawling could start any time now — baby-proof everything!',
    'Your baby understands "no" (even if they don\'t always listen).',
    'Pincer grasp is developing — tiny foods become possible.',
    'Separation anxiety peaks — it means baby loves you deeply.',
  ],
  10: [
    'Baby may pull to standing — watch out for those furniture edges!',
    'Waving "bye-bye" and clapping might start.',
    'Your baby understands far more words than they can say.',
    'First words could come any day now!',
  ],
  12: [
    'Happy almost-birthday! Baby may be taking first steps.',
    'Vocabulary is growing — baby may say 1-3 words with meaning.',
    'Your toddler-to-be has tripled their birth weight!',
    'Pointing at things they want is a big communication milestone.',
  ],
  15: [
    'Walking is becoming more confident every day.',
    'Your toddler may be stacking blocks and scribbling.',
    'Vocabulary explosion is coming — they\'re absorbing everything.',
    'Toddlers love to imitate — be their best role model!',
  ],
  18: [
    'Vocabulary may reach 10-50 words by now.',
    'Running (well, fast toddling) is a new superpower!',
    'Your child can follow simple instructions.',
    'Pretend play begins — watch for those imaginary tea parties.',
  ],
  24: [
    'Two-word phrases are emerging — "more milk", "daddy go".',
    'Your toddler is becoming a little person with big opinions!',
    'Jumping with both feet off the ground is a new achievement.',
    'Memory is developing — they remember where you hid the snacks.',
  ],
};

/** Pick insight content for the baby's current age */
function getInsights(ageMonths: number) {
  const ms = (() => {
    const keys = Object.keys(MILESTONES).map(Number).sort((a, b) => a - b);
    let k = 0;
    for (const key of keys) if (ageMonths >= key) k = key;
    return MILESTONES[k];
  })();

  // Find best matching fun facts
  const factKeys = Object.keys(FUN_FACTS).map(Number).sort((a, b) => a - b);
  let factKey = 0;
  for (const k of factKeys) if (ageMonths >= k) factKey = k;
  const facts = FUN_FACTS[factKey] || FUN_FACTS[0];

  // Pick 2 random fun facts
  const shuffled = [...facts].sort(() => Math.random() - 0.5);
  const selectedFacts = shuffled.slice(0, 2);

  // Pick a random tip from each milestone category
  const highlights: { emoji: string; category: string; item: string }[] = [];
  if (ms) {
    if (ms.motor.length) highlights.push({ emoji: '💪', category: 'Motor', item: ms.motor[Math.floor(Math.random() * ms.motor.length)] });
    if (ms.cog.length) highlights.push({ emoji: '🧠', category: 'Cognitive', item: ms.cog[Math.floor(Math.random() * ms.cog.length)] });
    if (ms.soc.length) highlights.push({ emoji: '💕', category: 'Social', item: ms.soc[Math.floor(Math.random() * ms.soc.length)] });
    if (ms.lang.length) highlights.push({ emoji: '🗣️', category: 'Language', item: ms.lang[Math.floor(Math.random() * ms.lang.length)] });
  }

  return { ms, highlights, selectedFacts, tip: ms?.tips || '' };
}

export default function HeroInsightOverlay({ age, babyName, onClose }: HeroInsightOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const insightsRef = useRef(getInsights(Math.floor(age)));

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => setContentVisible(true), 150);
    return () => clearTimeout(t);
  }, []);

  const handleClose = useCallback(() => {
    setContentVisible(false);
    setVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  const { highlights, selectedFacts, tip } = insightsRef.current;
  const ageMonths = Math.floor(age);
  const stageEmoji = age < 3 ? '🍼' : age < 6 ? '👶' : age < 12 ? '🧸' : age < 24 ? '🧒' : '🌟';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 250,
        background: visible ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
        transition: 'background 0.3s ease',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          background: `linear-gradient(170deg, ${C.bg} 0%, ${C.cd} 100%)`,
          borderRadius: '24px 24px 0 0',
          padding: '0 0 40px',
          maxHeight: '80vh',
          overflowY: 'auto',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Gradient header */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: `linear-gradient(145deg, ${C.p}, ${C.s} 50%, ${C.pu} 100%)`,
            borderRadius: '24px 24px 0 0',
            padding: '24px 20px 20px',
          }}
        >
          {/* Animated orbs */}
          <div style={{
            position: 'absolute', top: -20, right: -10, width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            animation: 'heroOrbFloat 6s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', bottom: -30, left: 20, width: 60, height: 60, borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)',
            animation: 'heroOrbFloat 8s ease-in-out infinite 1s',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 28, marginBottom: 4 }}>{stageEmoji}</div>
                <div style={{ color: 'white', fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>
                  {babyName || 'Your Baby'} at {ageMonths} month{ageMonths !== 1 ? 's' : ''}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4, fontWeight: 500 }}>
                  Development snapshot
                </div>
              </div>
              <button
                onClick={handleClose}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 12,
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', backdropFilter: 'blur(8px)',
                }}
              >
                <Ic n="x" s={18} c="white" />
              </button>
            </div>
          </div>
        </div>

        {/* Content sections with staggered reveal */}
        <div style={{ padding: '16px 20px 0' }}>

          {/* Fun Facts */}
          {selectedFacts.map((fact, i) => (
            <div
              key={i}
              style={{
                opacity: contentVisible ? 1 : 0,
                transform: contentVisible ? 'translateY(0)' : 'translateY(12px)',
                transition: `opacity 0.4s ease ${0.1 + i * 0.1}s, transform 0.4s ease ${0.1 + i * 0.1}s`,
                background: `${C.sl}66`,
                borderRadius: 14,
                padding: '12px 14px',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>✨</span>
              <div style={{ fontSize: 13, color: C.t, lineHeight: 1.5, fontWeight: 500 }}>{fact}</div>
            </div>
          ))}

          {/* Milestone highlights */}
          {highlights.length > 0 && (
            <div
              style={{
                opacity: contentVisible ? 1 : 0,
                transform: contentVisible ? 'translateY(0)' : 'translateY(12px)',
                transition: 'opacity 0.4s ease 0.3s, transform 0.4s ease 0.3s',
                marginTop: 8,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t, marginBottom: 10 }}>
                What to look for
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {highlights.map((h, i) => (
                  <div
                    key={h.category}
                    style={{
                      opacity: contentVisible ? 1 : 0,
                      transform: contentVisible ? 'scale(1)' : 'scale(0.92)',
                      transition: `opacity 0.35s ease ${0.35 + i * 0.08}s, transform 0.35s ease ${0.35 + i * 0.08}s`,
                      background: C.cd,
                      borderRadius: 14,
                      padding: '12px 12px',
                      border: `1px solid ${C.b}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>{h.emoji}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.tl, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h.category}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.t, lineHeight: 1.4 }}>{h.item}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pro tip */}
          {tip && (
            <div
              style={{
                opacity: contentVisible ? 1 : 0,
                transform: contentVisible ? 'translateY(0)' : 'translateY(12px)',
                transition: 'opacity 0.4s ease 0.55s, transform 0.4s ease 0.55s',
                marginTop: 14,
                background: `linear-gradient(135deg, ${C.p}15, ${C.s}15)`,
                borderRadius: 14,
                padding: '14px 16px',
                borderLeft: `3px solid ${C.s}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>💡</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.s }}>Pro tip</span>
              </div>
              <div style={{ fontSize: 12, color: C.t, lineHeight: 1.5 }}>{tip}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
