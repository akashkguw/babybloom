/**
 * HeroInsightOverlay — Back face of the hero card flip.
 * Shows age-appropriate baby development insights in a compact layout
 * that fits within the same card dimensions as the front face.
 * Tap the hero card to flip → shows this. Tap close to flip back.
 * No state is retained between flips — fresh insights each time.
 */
import { useMemo } from 'react';
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

/** Pick insight content for the baby's current age — called fresh each render (no memoization across flips) */
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
    if (ms.motor.length) highlights.push({ emoji: '\u{1F4AA}', category: 'Motor', item: ms.motor[Math.floor(Math.random() * ms.motor.length)] });
    if (ms.cog.length) highlights.push({ emoji: '\u{1F9E0}', category: 'Cognitive', item: ms.cog[Math.floor(Math.random() * ms.cog.length)] });
    if (ms.soc.length) highlights.push({ emoji: '\u{1F495}', category: 'Social', item: ms.soc[Math.floor(Math.random() * ms.soc.length)] });
    if (ms.lang.length) highlights.push({ emoji: '\u{1F5E3}\uFE0F', category: 'Language', item: ms.lang[Math.floor(Math.random() * ms.lang.length)] });
  }

  return { ms, highlights, selectedFacts, tip: ms?.tips || '' };
}

export default function HeroInsightOverlay({ age, babyName, onClose }: HeroInsightOverlayProps) {
  // useMemo keyed on age only — but since parent unmounts/remounts on each flip,
  // this effectively gives fresh random insights each time
  const { highlights, selectedFacts, tip } = useMemo(() => getInsights(Math.floor(age)), [age]);
  const ageMonths = Math.floor(age);
  const stageEmoji = age < 3 ? '\u{1F37C}' : age < 6 ? '\u{1F476}' : age < 12 ? '\u{1F9F8}' : age < 24 ? '\u{1F9D2}' : '\u{1F31F}';

  return (
    <div style={{
      position: 'absolute', inset: 0,
      backfaceVisibility: 'hidden',
      transform: 'rotateY(180deg)',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Decorative background orbs (match front face) */}
      <div style={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', animation: 'heroOrbFloat 8s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: -40, left: -25, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', animation: 'heroOrbFloat 10s ease-in-out infinite 2s' }} />

      {/* Main content — scrollable within card bounds */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: '14px 16px 10px',
        flex: 1, overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        {/* Header row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15 }}>{stageEmoji}</span>
            <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>
              {babyName || 'Your Baby'} at {ageMonths}mo
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10,
              width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', backdropFilter: 'blur(8px)', flexShrink: 0,
            }}
          >
            <Ic n="x" s={14} c="white" />
          </button>
        </div>

        {/* Fun Facts — compact */}
        {selectedFacts.map((fact, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: '6px 10px',
              marginBottom: 5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 7,
            }}
          >
            <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>{'\u2728'}</span>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.9)', lineHeight: 1.4, fontWeight: 500 }}>{fact}</div>
          </div>
        ))}

        {/* Milestone highlights — 2x2 compact grid */}
        {highlights.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              What to look for
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {highlights.map((h) => (
                <div
                  key={h.category}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    padding: '6px 8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                    <span style={{ fontSize: 10 }}>{h.emoji}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{h.category}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>{h.item}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pro tip — compact */}
        {tip && (
          <div style={{
            marginTop: 6,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '6px 10px',
            borderLeft: '2px solid rgba(255,255,255,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <span style={{ fontSize: 10 }}>{'\u{1F4A1}'}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Pro tip</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>{tip}</div>
          </div>
        )}
      </div>
    </div>
  );
}
