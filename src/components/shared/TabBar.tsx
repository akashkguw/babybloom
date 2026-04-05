import React, { useMemo } from 'react';
import { C } from '@/lib/constants/colors';
import Icon from './Icon';

interface TabBarProps {
  active: string;
  set: (tabId: string) => void;
}

interface TabItem {
  id: string;
  icon: string;
  l: string;
}

/** Measure the real env(safe-area-inset-bottom) once via DOM and cap it.
 *  This avoids CSS env()/max() issues in Safari iOS standalone PWA mode
 *  where inline styles and even stylesheet rules can silently fail.
 *  Falls back to a minimum of 8px so labels never touch the screen edge. */
function getSafeAreaBottom(cap = 34, min = 8): number {
  if (typeof document === 'undefined') return min;
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.bottom = '0';
  el.style.height = 'env(safe-area-inset-bottom, 0px)';
  el.style.visibility = 'hidden';
  el.style.pointerEvents = 'none';
  document.body.appendChild(el);
  const px = el.getBoundingClientRect().height;
  document.body.removeChild(el);
  return Math.max(Math.min(Math.round(px), cap), min);
}

export const TabBar: React.FC<TabBarProps> = ({ active, set }) => {
  const tabs: TabItem[] = [
    { id: 'home', icon: 'home', l: 'Home' },
    { id: 'log', icon: 'edit', l: 'Log' },
    { id: 'miles', icon: 'star', l: 'Milestones' },
    { id: 'guide', icon: 'book', l: 'Guide' },
    { id: 'safety', icon: 'shield', l: 'Safety' },
  ];

  const bgFrost = C.bg === '#1A1A2E' ? 'rgba(26,26,46,0.95)' : 'rgba(255,255,255,0.92)';

  // Measure once — the value never changes during the session
  const safeBottom = useMemo(() => getSafeAreaBottom(34, 8), []);

  return (
    <div
      className="tab-bar-main"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        maxWidth: 500,
        margin: '0 auto',
        background: bgFrost,
        boxShadow: C.bg === '#1A1A2E' ? '0 -8px 20px rgba(0,0,0,0.35)' : '0 -6px 16px rgba(0,0,0,0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: `1px solid ${C.b}`,
        display: 'flex',
        justifyContent: 'space-around',
        padding: `6px 0 ${safeBottom}px`,
        zIndex: 100,
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => set(t.id)}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            cursor: 'pointer',
            minHeight: 44,
            padding: '2px 8px',
            opacity: active === t.id ? 1 : 0.45,
            transition: 'opacity 0.2s ease, transform 0.1s ease',
          }}
        >
          <Icon
            n={t.icon}
            s={22}
            c={active === t.id ? C.p : C.tl}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: active === t.id ? 700 : 500,
              color: active === t.id ? C.p : C.tl,
            }}
          >
            {t.l}
          </span>
        </button>
      ))}
    </div>
  );
};

export default TabBar;
