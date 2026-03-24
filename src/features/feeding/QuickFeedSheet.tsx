import React from 'react';
import { C } from '@/lib/constants/colors';
import Input from '@/components/shared/Input';
import Button from '@/components/shared/Button';
import Icon from '@/components/shared/Icon';
import { mlToOz, fmtVol, volLabel } from '@/lib/utils/volume';
import { safeNum, LIMITS } from '@/lib/utils/validate';
import { toast } from '@/lib/utils/toast';

interface QuickFeedSheetProps {
  type: string | null;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  volumeUnit: 'ml' | 'oz';
  onSave: (amount: string, oz: number) => void;
}

export default function QuickFeedSheet({
  type,
  onClose,
  value,
  onChange,
  volumeUnit,
  onSave,
}: QuickFeedSheetProps) {
  if (!type) return null;

  const handleSave = () => {
    const lim = volumeUnit === 'ml' ? LIMITS.feedMl : LIMITS.feedOz;
    const num = safeNum(value, lim.min, lim.max, -1);
    if (num <= 0) {
      toast(`Amount must be ${lim.min}–${lim.max} ${volLabel(volumeUnit)}`);
      return;
    }
    const ozVal = volumeUnit === 'ml' ? mlToOz(num) : num;
    onSave(value + ' ' + volLabel(volumeUnit), ozVal);
    onChange('');
  };

  return (
    <div
      className="mo"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="ms">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: C.t }}>Log {type}</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Icon n="x" s={22} c={C.tl} />
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.tl, display: 'block', marginBottom: 4 }}>
            Amount ({volLabel(volumeUnit)})
          </label>
          <Input
            type="number"
            value={value}
            onChange={onChange}
            placeholder={volumeUnit === 'ml' ? 'e.g. 120' : 'e.g. 4'}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            label="Save"
            onClick={handleSave}
            color={C.a}
            full
          />
          <Button
            label="Cancel"
            onClick={onClose}
            outline
          />
        </div>
      </div>
    </div>
  );
}
