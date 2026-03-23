import React from 'react';
import { C } from '@/lib/constants/colors';

interface ProgressCircleProps {
  pct: number;
  sz?: number;
  sw?: number;
  color?: string;
  trackColor?: string;
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  pct,
  sz = 60,
  sw = 5,
  color = C.p,
  trackColor = C.b,
}) => {
  const r = (sz - sw) / 2;
  const circumference = r * 2 * Math.PI;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg
      width={sz}
      height={sz}
      style={{ transform: 'rotate(-90deg)' }}
    >
      <circle
        cx={sz / 2}
        cy={sz / 2}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={sw}
      />
      <circle
        cx={sz / 2}
        cy={sz / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s' }}
      />
    </svg>
  );
};

export default ProgressCircle;
