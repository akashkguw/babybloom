import React from 'react';
import { C } from '@/lib/constants/colors';

interface PillProps {
  label: string;
  active: boolean;
  onClick?: () => void;
  color?: string;
}

export const Pill: React.FC<PillProps> = ({
  label,
  active,
  onClick,
  color = C.p,
}) => {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '8px 14px',
        borderRadius: 16,
        border: active ? 'none' : `1px solid ${C.b}`,
        background: active ? color : C.cd,
        color: active ? 'white' : C.t,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
};

export default Pill;
