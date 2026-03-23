import React from 'react';
import { C } from '@/lib/constants/colors';
import Icon from './Icon';

interface SectionHeaderProps {
  icon: string;
  title: string;
  color: string;
  sub?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, color, sub }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: color + '15',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon n={icon} s={22} c={color} />
      </div>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.t, margin: 0 }}>
          {title}
        </h2>
        {sub && <p style={{ fontSize: 13, color: C.tl, margin: 0 }}>{sub}</p>}
      </div>
    </div>
  );
};

export default SectionHeader;
