import React from 'react';
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

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background:
          C.bg === '#1A1A2E'
            ? 'rgba(26,26,46,0.95)'
            : 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: `1px solid ${C.b}`,
        display: 'flex',
        justifyContent: 'space-around',
        paddingBottom: 20,
        paddingTop: 8,
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
            gap: 2,
            cursor: 'pointer',
            padding: '4px 8px',
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
