import React from 'react';
import { C } from '@/lib/constants/colors';

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, style = {}, onClick }) => {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.cd,
        borderRadius: 20,
        padding: '18px 20px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        border: `1px solid ${C.b}`,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Card;
