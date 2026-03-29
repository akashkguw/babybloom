import React from 'react';
import { C } from '@/lib/constants/colors';

interface PillProps {
  label: string;
  active: boolean;
  onClick?: () => void;
  color?: string;
}

/** Returns true if the hex color is light enough to need dark text */
function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Relative luminance threshold for WCAG contrast
  return (r * 0.299 + g * 0.587 + b * 0.114) > 160;
}

export const Pill: React.FC<PillProps> = ({
  label,
  active,
  onClick,
  color = C.p,
}) => {
  const activeTextColor = isLightColor(color) ? '#1a1a2e' : 'white';
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '8px 14px',
        borderRadius: 16,
        border: active ? 'none' : `1px solid ${C.b}`,
        background: active ? color : C.cd,
        color: active ? activeTextColor : C.t,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s ease, color 0.15s ease, transform 0.1s ease',
      }}
    >
      {label}
    </button>
  );
};

export default Pill;
