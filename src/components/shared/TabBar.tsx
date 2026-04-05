import React, { useState, useEffect } from 'react';
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

export const TabBar: React.FC<TabBarProps> = ({ active, set }) => {
  const tabs: TabItem[] = [
    { id: 'home', icon: 'home', l: 'Home' },
    { id: 'log', icon: 'edit', l: 'Log' },
    { id: 'miles', icon: 'star', l: 'Milestones' },
    { id: 'guide', icon: 'book', l: 'Guide' },
    { id: 'safety', icon: 'shield', l: 'Safety' },
  ];

  const bgFrost = C.bg === '#1A1A2E' ? 'rgba(26,26,46,0.95)' : 'rgba(255,255,255,0.92)';

  const [safeBottom, setSafeBottom] = useState(0);
  useEffect(() => {
    // Standalone PWA (Home Screen): viewport-fit:cover is NOT fully
    // respected — bottom:0 already sits above the home indicator.
    // Adding env(safe-area-inset-bottom) double-counts the space.
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      // No extra padding needed — OS handles the home indicator gap
      setSafeBottom(0);
    } else {
      // Browser mode: bottom:0 is at the physical screen bottom
      // (viewport-fit:cover works). Measure the real safe area.
      try {
        const el = document.createElement('div');
        el.style.position = 'fixed';
        el.style.bottom = '0';
        el.style.height = 'env(safe-area-inset-bottom, 0px)';
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
        document.body.appendChild(el);
        const px = el.getBoundingClientRect().height;
        document.body.removeChild(el);
        setSafeBottom(Math.round(px));
      } catch { /* fallback 0 */ }
    }
  }, []);

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
