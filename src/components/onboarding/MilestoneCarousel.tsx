/**
 * MilestoneCarousel — 2-Year Celebration
 * Shown once when baby reaches 24 months. Highlights key activities
 * from the first 2 years. Re-accessible from the hero widget.
 */
import { useState, useCallback } from 'react';
import { C } from '@/lib/constants/colors';
import { Button as Btn, Icon as Ic } from '@/components/shared';

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

interface Logs {
  feed?: LogEntry[];
  diaper?: LogEntry[];
  sleep?: LogEntry[];
  tummy?: LogEntry[];
  growth?: LogEntry[];
  bath?: LogEntry[];
  massage?: LogEntry[];
  [key: string]: LogEntry[] | undefined;
}

interface MilestoneCarouselProps {
  babyName: string;
  birth: string;
  logs: Logs;
  milestonesChecked: number;
  teethCount: number;
  firstsCount: number;
  onDismiss: () => void;
}

interface Slide {
  emoji: string;
  title: string;
  subtitle: string;
  stat?: string;
  bg: string;
}

function computeStats(logs: Logs, birth: string): Slide[] {
  const slides: Slide[] = [];
  const twoYearsAfterBirth = new Date(birth + 'T00:00:00');
  twoYearsAfterBirth.setFullYear(twoYearsAfterBirth.getFullYear() + 2);
  const cutoff = twoYearsAfterBirth.toISOString().slice(0, 10);

  // Only include pre-2yr data
  const pre2yr = (arr: LogEntry[] | undefined) =>
    (arr || []).filter((e) => e.date <= cutoff);

  const feeds = pre2yr(logs.feed);
  const diapers = pre2yr(logs.diaper);
  const sleeps = pre2yr(logs.sleep);
  const baths = pre2yr(logs.bath);
  const tummies = pre2yr(logs.tummy);

  // Intro slide
  slides.push({
    emoji: '🎉',
    title: `Happy 2nd Birthday!`,
    subtitle: `What an incredible journey these 2 years have been`,
    bg: 'linear-gradient(135deg, #FF6B8A, #FF8FA0)',
  });

  // Feeding
  if (feeds.length > 0) {
    const breastFeeds = feeds.filter((e) => e.type?.startsWith('Breast'));
    let totalMins = 0;
    breastFeeds.forEach((e) => { totalMins += e.mins || 0; });
    const hours = Math.round(totalMins / 60);
    slides.push({
      emoji: '🍼',
      title: `${feeds.length.toLocaleString()} feeds logged`,
      subtitle: hours > 0
        ? `Including ${hours} hours of nursing — you nourished every step of the way`
        : `Every feed, carefully tracked with love`,
      stat: feeds.length.toLocaleString(),
      bg: 'linear-gradient(135deg, #6C63FF, #8B83FF)',
    });
  }

  // Diapers
  if (diapers.length > 0) {
    slides.push({
      emoji: '👶',
      title: `${diapers.length.toLocaleString()} diaper changes`,
      subtitle: `That's a lot of love (and patience!)`,
      stat: diapers.length.toLocaleString(),
      bg: 'linear-gradient(135deg, #4CAF50, #66BB6A)',
    });
  }

  // Sleep
  const sleepEntries = sleeps.filter((e) => e.type === 'Nap' || e.type === 'Night Sleep');
  if (sleepEntries.length > 0) {
    const naps = sleepEntries.filter((e) => e.type === 'Nap').length;
    const nights = sleepEntries.filter((e) => e.type === 'Night Sleep').length;
    slides.push({
      emoji: '😴',
      title: `${sleepEntries.length} sleep sessions`,
      subtitle: `${naps} naps and ${nights} nights — sweet dreams, little one`,
      stat: sleepEntries.length.toLocaleString(),
      bg: 'linear-gradient(135deg, #5C6BC0, #7986CB)',
    });
  }

  // Tummy time
  if (tummies.length > 0) {
    slides.push({
      emoji: '🧒',
      title: `${tummies.length} tummy time sessions`,
      subtitle: `Building strength from day one — look how far they've come!`,
      bg: 'linear-gradient(135deg, #FF9800, #FFB74D)',
    });
  }

  // Baths
  if (baths.length > 10) {
    slides.push({
      emoji: '🛁',
      title: `${baths.length} bath times`,
      subtitle: `Splish splash — from tiny baby tub to big kid baths`,
      bg: 'linear-gradient(135deg, #26C6DA, #4DD0E1)',
    });
  }

  // Closing slide
  slides.push({
    emoji: '💗',
    title: `You're an amazing parent`,
    subtitle: `You can still use BabyBloom to track activities, but automated alerts will be turned off now. Your little one is growing up!`,
    bg: 'linear-gradient(135deg, #FF6B8A, #CE93D8)',
  });

  return slides;
}

export default function MilestoneCarousel({
  babyName, birth, logs, milestonesChecked, teethCount, firstsCount, onDismiss,
}: MilestoneCarouselProps) {
  const slides = computeStats(logs, birth);
  const [idx, setIdx] = useState(0);
  const isLast = idx === slides.length - 1;
  const slide = slides[idx];

  const next = useCallback(() => {
    if (isLast) { onDismiss(); return; }
    setIdx((i) => Math.min(i + 1, slides.length - 1));
  }, [isLast, onDismiss, slides.length]);

  const prev = useCallback(() => {
    setIdx((i) => Math.max(i - 1, 0));
  }, []);

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 300, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: slide.bg,
        transition: 'background 0.5s ease',
      }}
    >
      {/* Skip button */}
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute', top: 'calc(16px + env(safe-area-inset-top, 0px))', right: 16,
          background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 20,
          padding: '6px 14px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600,
        }}
      >
        Skip
      </button>

      {/* Content */}
      <div style={{ textAlign: 'center', padding: '0 32px', maxWidth: 380 }}>
        <div style={{ fontSize: 72, marginBottom: 20 }}>{slide.emoji}</div>
        <h2 style={{
          fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 12,
          lineHeight: 1.3, textShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {slide.title.replace('2nd Birthday', `2nd Birthday, ${babyName}`)}
        </h2>
        <p style={{
          fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6,
          textShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}>
          {slide.subtitle}
        </p>

        {/* Milestones/firsts on closing slide */}
        {isLast && (milestonesChecked > 0 || firstsCount > 0 || teethCount > 0) && (
          <div style={{
            marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
          }}>
            {milestonesChecked > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '8px 14px',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{milestonesChecked}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>milestones</div>
              </div>
            )}
            {teethCount > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '8px 14px',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{teethCount}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>teeth</div>
              </div>
            )}
            {firstsCount > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '8px 14px',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{firstsCount}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>firsts</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{
        position: 'absolute', bottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
        left: 0, right: 0, padding: '0 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        {/* Dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {slides.map((_, i) => (
            <div
              key={i}
              onClick={() => setIdx(i)}
              style={{
                width: i === idx ? 20 : 8, height: 8, borderRadius: 4,
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer', transition: 'all 0.3s',
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 320 }}>
          {idx > 0 && (
            <button
              onClick={prev}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 14,
                background: 'rgba(255,255,255,0.2)', border: 'none',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={next}
            style={{
              flex: 2, padding: '14px 0', borderRadius: 14,
              background: '#fff', border: 'none',
              color: slide.bg.includes('#FF6B8A') ? '#FF6B8A' : '#6C63FF',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            {isLast ? 'Continue using BabyBloom' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
