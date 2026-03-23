import React from 'react';
import { C } from '@/lib/constants/colors';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  style?: React.CSSProperties;
}

export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  type = 'text',
  placeholder = '',
  style = {},
}) => {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: 12,
        border: `1.5px solid ${C.b}`,
        fontSize: 16,
        color: C.t,
        background: C.bg,
        outline: 'none',
        boxSizing: 'border-box',
        ...style,
      }}
    />
  );
};

export default Input;
