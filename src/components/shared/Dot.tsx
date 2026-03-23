import React from 'react';
import { C } from '@/lib/constants/colors';

interface DotProps {
  items: string[];
  color?: string;
}

export const Dot: React.FC<DotProps> = ({ items, color = C.a }) => {
  return (
    <>
      {items.map((text, i) => (
        <div
          key={i}
          style={{
            fontSize: 13,
            color: C.t,
            display: 'flex',
            gap: 6,
            marginBottom: 3,
          }}
        >
          <span style={{ color }}>{'\u2022'}</span>
          {text}
        </div>
      ))}
    </>
  );
};

export default Dot;
