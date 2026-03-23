import React from 'react';
import { C } from '@/lib/constants/colors';

interface ButtonProps {
  label: string;
  onClick?: () => void;
  color?: string;
  outline?: boolean;
  full?: boolean;
  small?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  color = C.s,
  outline = false,
  full = false,
  small = false,
}) => {
  return (
    <button
      onClick={onClick}
      style={{
        width: full ? '100%' : 'auto',
        padding: small ? '8px 16px' : '14px 20px',
        borderRadius: 14,
        border: outline ? `2px solid ${color}` : 'none',
        background: outline ? 'transparent' : color,
        color: outline ? color : 'white',
        fontSize: small ? 13 : 15,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
};

export default Button;
