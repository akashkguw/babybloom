/**
 * HeroBackgroundPicker — lets users choose a hero widget background.
 * Options: built-in gradient presets or a custom photo from device.
 * Selection is persisted in IndexedDB under the key 'hero_bg'.
 */

import { useState, useEffect, useRef } from 'react';
import { C } from '@/lib/constants/colors';
import { ds, dg } from '@/lib/db';
import Icon from '@/components/shared/Icon';
import { toast } from '@/lib/utils/toast';

export interface HeroBgSetting {
  type: 'gradient' | 'photo';
  value: string; // gradient CSS string or base64 data URL
  id: string;    // preset id or 'custom'
}

export const HERO_BG_KEY = 'hero_bg';

export const BUILTIN_GRADIENTS: { id: string; label: string; emoji: string; css: string }[] = [
  { id: 'default',  label: 'Default',       emoji: '🌸', css: '' }, // empty = use theme default
  { id: 'sunset',   label: 'Sunset Glow',   emoji: '🌅', css: 'linear-gradient(145deg, #FF6B8A, #FF9A76 40%, #FFD93D 80%)' },
  { id: 'ocean',    label: 'Ocean Breeze',   emoji: '🌊', css: 'linear-gradient(145deg, #667eea, #764ba2 40%, #f093fb 80%)' },
  { id: 'forest',   label: 'Forest Walk',    emoji: '🌿', css: 'linear-gradient(145deg, #11998e, #38ef7d 50%, #88d8a8 100%)' },
  { id: 'lavender', label: 'Lavender Dream', emoji: '💜', css: 'linear-gradient(145deg, #a18cd1, #fbc2eb 50%, #f6d5f7 100%)' },
  { id: 'midnight', label: 'Midnight Sky',   emoji: '🌙', css: 'linear-gradient(145deg, #0f0c29, #302b63 40%, #24243e 100%)' },
  { id: 'peach',    label: 'Peach Blossom',  emoji: '🍑', css: 'linear-gradient(145deg, #ffecd2, #fcb69f 50%, #ff9a9e 100%)' },
  { id: 'aurora',   label: 'Aurora',         emoji: '✨', css: 'linear-gradient(145deg, #00c6fb, #005bea 40%, #a855f7 80%)' },
];

const MAX_IMG_SIZE = 800; // px — resize uploaded images to this max dimension

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > MAX_IMG_SIZE || h > MAX_IMG_SIZE) {
          if (w > h) { h = Math.round(h * MAX_IMG_SIZE / w); w = MAX_IMG_SIZE; }
          else { w = Math.round(w * MAX_IMG_SIZE / h); h = MAX_IMG_SIZE; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

interface Props {
  onChange?: (bg: HeroBgSetting | null) => void;
}

export default function HeroBackgroundPicker({ onChange }: Props) {
  const [selected, setSelected] = useState<string>('default');
  const [customThumb, setCustomThumb] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load saved setting
  useEffect(() => {
    dg(HERO_BG_KEY).then((saved: HeroBgSetting | null) => {
      if (saved) {
        setSelected(saved.id);
        if (saved.type === 'photo') setCustomThumb(saved.value);
      }
    });
  }, []);

  const pick = (id: string) => {
    if (id === 'custom') {
      fileRef.current?.click();
      return;
    }
    setSelected(id);
    const preset = BUILTIN_GRADIENTS.find(g => g.id === id);
    if (!preset) return;
    const bg: HeroBgSetting | null = id === 'default'
      ? null // null = use theme default
      : { type: 'gradient', value: preset.css, id };
    ds(HERO_BG_KEY, bg);
    if (onChange) onChange(bg);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Please select an image file');
      return;
    }
    try {
      const dataUrl = await resizeImage(file);
      const bg: HeroBgSetting = { type: 'photo', value: dataUrl, id: 'custom' };
      await ds(HERO_BG_KEY, bg);
      setSelected('custom');
      setCustomThumb(dataUrl);
      if (onChange) onChange(bg);
      toast('Background updated!');
    } catch {
      toast('Could not process image');
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.tl, marginBottom: 10 }}>
        Choose a background for the hero card on your home screen
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {BUILTIN_GRADIENTS.map(g => {
          const isActive = selected === g.id;
          const preview = g.id === 'default'
            ? `linear-gradient(145deg, ${C.p}, ${C.s} 40%, ${C.pu} 70%, ${C.p} 100%)`
            : g.css;
          return (
            <div
              key={g.id}
              onClick={() => pick(g.id)}
              style={{
                borderRadius: 14,
                overflow: 'hidden',
                border: `2px solid ${isActive ? C.a : C.b}`,
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{
                height: 56,
                background: preview,
                backgroundSize: '200% 200%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {isActive && (
                  <div style={{
                    width: 24, height: 24, borderRadius: 12,
                    background: 'rgba(255,255,255,0.9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon n="check" s={14} c={C.a} />
                  </div>
                )}
              </div>
              <div style={{
                padding: '6px 8px',
                background: C.bg,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 14, lineHeight: 1 }}>{g.emoji}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.t, marginTop: 2, lineHeight: 1.2 }}>{g.label}</div>
              </div>
            </div>
          );
        })}

        {/* Custom photo option */}
        <div
          onClick={() => pick('custom')}
          style={{
            borderRadius: 14,
            overflow: 'hidden',
            border: `2px solid ${selected === 'custom' ? C.a : C.b}`,
            cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
        >
          <div style={{
            height: 56,
            background: customThumb
              ? `url(${customThumb}) center/cover no-repeat`
              : `linear-gradient(135deg, ${C.b}, ${C.tl})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {selected === 'custom' && customThumb ? (
              <div style={{
                width: 24, height: 24, borderRadius: 12,
                background: 'rgba(255,255,255,0.9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon n="check" s={14} c={C.a} />
              </div>
            ) : (
              <Icon n="camera" s={20} c="rgba(255,255,255,0.8)" />
            )}
          </div>
          <div style={{
            padding: '6px 8px',
            background: C.bg,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, lineHeight: 1 }}>📷</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.t, marginTop: 2, lineHeight: 1.2 }}>My Photo</div>
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
    </div>
  );
}
