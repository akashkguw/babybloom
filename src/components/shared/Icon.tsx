import React from 'react';
import { IP } from '@/lib/constants/icons';

interface IconProps {
  n: string; // icon name
  s?: number; // size
  c?: string; // color
  st?: React.CSSProperties; // extra style
}

export const Icon: React.FC<IconProps> = ({ n, s: sz = 20, c = '#333', st = {} }) => {
  const paths = (IP[n as keyof typeof IP] || '').split('|');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={sz}
      height={sz}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...st,
      }}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
};

export default Icon;
