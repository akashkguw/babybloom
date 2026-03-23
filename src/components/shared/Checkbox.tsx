import React from 'react';
import { C } from '@/lib/constants/colors';
import Icon from './Icon';

interface CheckboxProps {
  ck: boolean;
  color?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ ck, color = C.ok }) => {
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        border: ck ? 'none' : `2px solid ${C.b}`,
        background: ck ? color : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {ck && <Icon n="check" s={14} c="#fff" />}
    </div>
  );
};

export default Checkbox;
