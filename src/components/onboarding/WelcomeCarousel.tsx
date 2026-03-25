import { useState, useRef } from 'react';
import { C } from '@/lib/constants/colors';
import type { CountryConfig } from '@/lib/constants/countries';

interface WelcomeSlide {
  icon: string;
  bg: string;
  title: string;
  desc: string;
  p0?: boolean;
  visual?: React.ReactNode;
}

interface WelcomeCarouselProps {
  countryConfig: CountryConfig;
  babyName: string;
  onDismiss: () => void;
}

/* ── Mini mock button used in Quick Log visual ── */
function MockBtn({ emoji, label, border, bg, color }: { emoji: string; label: string; border?: string; bg?: string; color?: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '6px 2px', borderRadius: 10,
      background: bg || C.bg, border: `1px solid ${border || C.b}`,
      flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 16 }}>{emoji}</div>
      <div style={{ fontSize: 8, color: color || C.tl, marginTop: 1, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export default function WelcomeCarousel({ countryConfig, babyName, onDismiss }: WelcomeCarouselProps) {
  const [idx, setIdx] = useState(0);
  const touchX = useRef<number | null>(null);
  const name = babyName || 'your baby';

  /* ── Slide 2 visual: Quick Log mockup with color states + timer ── */
  const quickLogVisual = (
    <div style={{ maxWidth: 300, margin: '16px auto 0' }}>
      <div style={{
        background: C.cd, borderRadius: 16, padding: '12px 10px 10px',
        border: `1px solid ${C.b}`, boxShadow: `0 4px 16px rgba(0,0,0,0.08)`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t, marginBottom: 6, paddingLeft: 2 }}>Quick Log</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
          {/* Active timer state */}
          <MockBtn emoji="🤱" label="Breast L" border={C.a} bg={C.al} color={C.a} />
          <MockBtn emoji="🤱" label="Breast R" />
          <MockBtn emoji="🍼" label="Formula" />
          <MockBtn emoji="🧒" label="Tummy" />
          {/* Danger — red */}
          <MockBtn emoji="💧" label="Wet" border="rgba(220,38,38,0.5)" bg="rgba(220,38,38,0.10)" color="#dc2626" />
          {/* Warning — amber */}
          <MockBtn emoji="💩" label="Dirty" border="rgba(245,158,11,0.5)" bg="rgba(245,158,11,0.10)" color="#d97706" />
          <MockBtn emoji="😴" label="Sleep" />
          <MockBtn emoji="🥣" label="Solids" />
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '0 2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: '#dc2626' }} />
            <span style={{ fontSize: 7, color: '#dc2626', fontWeight: 700 }}>Needs attention</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: '#d97706' }} />
            <span style={{ fontSize: 7, color: '#d97706', fontWeight: 700 }}>Due soon</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: C.a }} />
            <span style={{ fontSize: 7, color: C.a, fontWeight: 700 }}>Timer on</span>
          </div>
        </div>
      </div>
      {/* Timer callout */}
      <div style={{
        marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 12,
        background: C.al, border: `1px solid ${C.a}33`,
      }}>
        <div style={{ fontSize: 18 }}>🤱</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.a }}>Breast L</div>
          <div style={{ fontSize: 8, color: C.tl }}>since 2:34 PM</div>
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.a, fontVariantNumeric: 'tabular-nums' }}>12:45</div>
        <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
          {['🔄'].map((e) => (
            <div key={e} style={{
              width: 28, height: 28, borderRadius: 8, background: C.bg, border: `1px solid ${C.b}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
            }}>{e}</div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── Slide 3 visual: Safety toolkit ── */
  const safetyVisual = (
    <div style={{ maxWidth: 300, margin: '16px auto 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{
        padding: '7px 10px', borderRadius: 10,
        borderLeft: `3px solid ${C.bl}`, background: C.bll + '66',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 13 }}>💉</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.bl }}>{countryConfig.medical.authority} Vaccine Schedule</div>
          <div style={{ fontSize: 8, color: C.t }}>Alerts when doses are due — track what's done</div>
        </div>
      </div>
      <div style={{
        padding: '7px 10px', borderRadius: 10,
        borderLeft: `3px solid ${C.p}`, background: C.pl,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 13 }}>🆘</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.p }}>Emergency — {countryConfig.emergency.primaryNumber}</div>
          <div style={{ fontSize: 8, color: C.t }}>One-tap call, CPR steps, choking guide — always offline</div>
        </div>
      </div>
      <div style={{
        padding: '7px 10px', borderRadius: 10,
        borderLeft: `3px solid ${C.pu}`, background: C.pul,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 13 }}>💊</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.pu }}>Medicine Dosing Calculator</div>
          <div style={{ fontSize: 8, color: C.t }}>{countryConfig.medicines.antipyretic.name} & {countryConfig.medicines.antiInflammatory.name} — by weight</div>
        </div>
      </div>
    </div>
  );

  /* ── Slide 4 visual: Partner sync + Report + Stats + Privacy ── */
  const teamVisual = (
    <div style={{ maxWidth: 300, margin: '16px auto 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {/* Partner sync */}
      <div style={{
        padding: '8px 10px', borderRadius: 10,
        background: C.cd, border: `1px solid ${C.b}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.s}, ${C.pu})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>👫</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t }}>Partner Sync</div>
          <div style={{ fontSize: 8, color: C.tl }}>Both parents see the same data — scan a QR code to link phones</div>
        </div>
      </div>
      {/* Pediatrician report */}
      <div style={{
        padding: '8px 10px', borderRadius: 10,
        background: C.cd, border: `1px solid ${C.b}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.a}, #00B4D8)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>📋</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t }}>Pediatrician Report</div>
          <div style={{ fontSize: 8, color: C.tl }}>One-tap summary of feeds, sleep, growth & vaccines — ready for the doctor</div>
        </div>
      </div>
      {/* Daily stats */}
      <div style={{
        padding: '8px 10px', borderRadius: 10,
        background: C.cd, border: `1px solid ${C.b}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.p}cc, #FF8FA3)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>📊</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t }}>Daily Stats</div>
          <div style={{ fontSize: 8, color: C.tl }}>Feeds, diapers, sleep hours — at a glance on your home screen</div>
        </div>
      </div>
      {/* Privacy badge */}
      <div style={{
        marginTop: 2, padding: '6px 10px', borderRadius: 10,
        background: C.okl, border: `1px solid ${C.ok}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      }}>
        <span style={{ fontSize: 11 }}>🔒</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: C.ok }}>All data stored on your device — nothing leaves your phone</span>
      </div>
    </div>
  );

  /* ── Slide 2 visual: Smart alerts mockup ── */
  const alertsVisual = (
    <div style={{ maxWidth: 300, margin: '16px auto 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{
        padding: '7px 10px', borderRadius: 10,
        borderLeft: `3px solid ${C.p}`, background: C.pl,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 13 }}>🍼</span>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.p }}>Feed now</div>
          <div style={{ fontSize: 8, color: C.t }}>No feed in 5h — longer than usual</div>
        </div>
      </div>
      <div style={{
        padding: '7px 10px', borderRadius: 10,
        borderLeft: `3px solid ${C.w}`, background: C.wl,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 13 }}>💧</span>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.w }}>Check hydration</div>
          <div style={{ fontSize: 8, color: C.t }}>Only 2 wet diapers today</div>
        </div>
      </div>
      <div style={{
        padding: '7px 10px', borderRadius: 10,
        borderLeft: `3px solid ${C.a}`, background: C.al,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 13 }}>💡</span>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.a }}>Tummy time</div>
          <div style={{ fontSize: 8, color: C.t }}>Great for neck strength — try 3-5 min today</div>
        </div>
      </div>
      <div style={{ fontSize: 8, color: C.tl, textAlign: 'center', marginTop: 2, fontStyle: 'italic' }}>
        Sorted by urgency — red first, green last
      </div>
    </div>
  );

  const slides: WelcomeSlide[] = [
    {
      icon: '👋',
      bg: `linear-gradient(135deg, ${C.p}, ${C.s})`,
      title: `Hey ${babyName || 'there'}!`,
      desc: `BabyBloom is built on ${countryConfig.medical.authority} guidelines. Your data never leaves your phone — private, offline, and always yours.`,
    },
    {
      icon: '⚡',
      bg: `linear-gradient(135deg, ${C.a}, #00B4D8)`,
      title: 'Your Smart Dashboard',
      desc: `One-tap logging with built-in timers and live daily stats. Buttons glow red when ${name} needs attention — you'll never miss a thing.`,
      visual: quickLogVisual,
      p0: true,
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
      icon: '🤝',
      bg: `linear-gradient(135deg, ${C.s}, ${C.pu})`,
      title: 'Built for Your Team',
      desc: `Sync with your partner so both parents stay in the loop. Generate a pediatrician report before every visit — all from your logs.`,
      visual: teamVisual,
    },
    {
      icon: '🚀',
      bg: `linear-gradient(135deg, ${C.p}, ${C.s} 50%, ${C.pu})`,
      title: 'You\'re Ready!',
      desc: `Log ${name}'s first feed or diaper — the more you track, the smarter your dashboard gets.`,
    },
  ];

  const total = slides.length;
  const isLast = idx === total - 1;
  const slide = slides[idx];
  const hasVisual = !!slide.visual;

  const goNext = () => { if (idx < total - 1) setIdx(idx + 1); else onDismiss(); };
  const goPrev = () => { if (idx > 0) setIdx(idx - 1); };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: C.bg,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Skip button */}
      <div style={{ padding: '12px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <div
          onClick={onDismiss}
          style={{
            fontSize: 13, color: C.tl, cursor: 'pointer', padding: '6px 12px',
            borderRadius: 20, background: C.cd, border: `1px solid ${C.b}`,
          }}
        >
          Skip
        </div>
      </div>

      {/* Main swipeable area */}
      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: hasVisual ? 'flex-start' : 'center',
          padding: hasVisual ? '12px 24px 0' : '0 28px',
          overflowY: 'auto',
        }}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const diff = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(diff) < 50) return;
          if (diff < 0) goNext();
          else goPrev();
        }}
      >
        {/* Icon circle — compact for visual slides */}
        <div style={{
          width: hasVisual ? 72 : 110, height: hasVisual ? 72 : 110,
          borderRadius: '50%', margin: `0 auto ${hasVisual ? 14 : 24}px`,
          background: slide.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 10px 32px ${C.p}33`,
          transition: 'all 0.3s',
          position: 'relative', flexShrink: 0,
        }}>
          <span style={{
            fontSize: hasVisual ? 32 : 48,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
          }}>{slide.icon}</span>
          {slide.p0 && (
            <div style={{
              position: 'absolute', top: hasVisual ? -2 : 0, right: hasVisual ? -2 : 0,
              background: '#FF4757', color: 'white', fontSize: 7, fontWeight: 800,
              padding: '2px 5px', borderRadius: 8, letterSpacing: 0.5,
              boxShadow: '0 2px 6px rgba(255,71,87,0.4)',
            }}>
              CRITICAL
            </div>
          )}
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: hasVisual ? 20 : 24, fontWeight: 800, color: C.t, textAlign: 'center',
          marginBottom: 8, lineHeight: 1.2, flexShrink: 0,
        }}>
          {slide.title}
        </h2>

        {/* Description */}
        <p style={{
          fontSize: 13, color: C.tl, textAlign: 'center', lineHeight: 1.65,
          maxWidth: 320, margin: '0 auto', flexShrink: 0,
        }}>
          {slide.desc}
        </p>

        {/* Visual mockup */}
        {slide.visual && (
          <div style={{ flexShrink: 0 }}>{slide.visual}</div>
        )}
      </div>

      {/* Bottom: dots + next */}
      <div style={{ padding: '0 28px 36px', flexShrink: 0 }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
          {slides.map((_, i) => (
            <div
              key={i}
              onClick={() => setIdx(i)}
              style={{
                width: i === idx ? 20 : 8,
                height: 8,
                borderRadius: 4,
                background: i === idx ? C.p : i < idx ? C.p + '66' : C.b,
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
              }}
            />
          ))}
        </div>

        {/* Next / Let's Go */}
        <div
          onClick={goNext}
          style={{
            width: '100%', padding: '15px 0', borderRadius: 16, cursor: 'pointer',
            background: isLast
              ? `linear-gradient(135deg, ${C.p}, ${C.s})`
              : C.p,
            color: 'white', fontSize: 16, fontWeight: 700,
            textAlign: 'center',
            boxShadow: `0 4px 16px ${C.p}44`,
            transition: 'all 0.2s',
          }}
        >
          {isLast ? 'Let\'s Go!' : 'Next'}
        </div>
      </div>
    </div>
  );
}
