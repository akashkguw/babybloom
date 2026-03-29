import React from 'react';
import { C } from '@/lib/constants/colors';
import Icon from './Icon';

interface TabHeaderProps {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  /** Optional secondary gradient color (defaults to C.s) */
  gradientEnd?: string;
  /** Optional right-side content */
  right?: React.ReactNode;
}

/**
 * TabHeader — gradient banner header for non-Home tabs.
 * Matches the Home tab's hero UX language: gradient background,
 * glassmorphic accents, subtle decorative orbs, and consistent typography.
 */
export const TabHeader: React.FC<TabHeaderProps> = ({
  icon,
  title,
  subtitle,
  color,
  gradientEnd,
  right,
}) => {
  const end = gradientEnd || C.s;

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
        isolation: 'isolate' as const,
        background: `linear-gradient(145deg, ${color}, ${end} 60%, ${C.pu} 100%)`,
        boxShadow: `0 4px 16px ${color}33, 0 2px 6px rgba(0,0,0,0.08)`,
      }}
    >
      {/* Decorative orbs — matching Home hero style */}
      <div
        style={{
          position: 'absolute',
          top: -20,
          right: -15,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -25,
          left: -10,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon n={icon} s={20} c="rgba(255,255,255,0.95)" />
          </div>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'white',
                lineHeight: 1.2,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.75)',
                fontWeight: 500,
                marginTop: 1,
              }}
            >
              {subtitle}
            </div>
          </div>
        </div>
        {right && <div>{right}</div>}
      </div>
    </div>
  );
};

export default TabHeader;
