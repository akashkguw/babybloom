/**
 * HeroBackgroundPicker — lets users choose a hero widget background.
 * Options: built-in gradient presets or a custom photo from device.
 * Selection is persisted in IndexedDB under the key 'hero_bg'.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { C } from '@/lib/constants/colors';
import { ds, dg } from '@/lib/db';
import Icon from '@/components/shared/Icon';
import { toast } from '@/lib/utils/toast';

export interface HeroBgSetting {
  type: 'gradient' | 'photo';
  value: string; // gradient CSS string or base64 data URL
  id: string;    // preset id or 'custom'
  position?: { x: number; y: number }; // background-position as percentages (0-100), default 50/50
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

/** Clamp a value between min and max */
export function clampPosition(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export default function HeroBackgroundPicker({ onChange }: Props) {
  const [selected, setSelected] = useState<string>('default');
  const [customThumb, setCustomThumb] = useState<string | null>(null);
  const [photoPos, setPhotoPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const fileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  // Load saved setting
  useEffect(() => {
    dg(HERO_BG_KEY).then((saved: HeroBgSetting | null) => {
      if (saved) {
        setSelected(saved.id);
        if (saved.type === 'photo') {
          setCustomThumb(saved.value);
          if (saved.position) setPhotoPos(saved.position);
        }
      }
    });
  }, []);

  const savePosition = useCallback(async (pos: { x: number; y: number }) => {
    const saved = await dg(HERO_BG_KEY) as HeroBgSetting | null;
    if (saved?.type === 'photo') {
      const updated: HeroBgSetting = { ...saved, position: pos };
      await ds(HERO_BG_KEY, updated);
      if (onChange) onChange(updated);
    }
  }, [onChange]);

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    dragState.current = {
      startX: clientX,
      startY: clientY,
      startPosX: photoPos.x,
      startPosY: photoPos.y,
    };
  }, [photoPos]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!dragState.current || !dragRef.current) return;
    const rect = dragRef.current.getBoundingClientRect();
    // Convert pixel delta to percentage of container
    const dx = ((clientX - dragState.current.startX) / rect.width) * 100;
    const dy = ((clientY - dragState.current.startY) / rect.height) * 100;
    // Invert: dragging right moves the visible window right = decrease background-position x
    const newX = clampPosition(dragState.current.startPosX - dx);
    const newY = clampPosition(dragState.current.startPosY - dy);
    setPhotoPos({ x: newX, y: newY });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!dragState.current) return;
    dragState.current = null;
    savePosition(photoPos);
  }, [photoPos, savePosition]);

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
      const defaultPos = { x: 50, y: 50 };
      const bg: HeroBgSetting = { type: 'photo', value: dataUrl, id: 'custom', position: defaultPos };
      await ds(HERO_BG_KEY, bg);
      setSelected('custom');
      setCustomThumb(dataUrl);
      setPhotoPos(defaultPos);
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

      {/* Drag-to-reposition preview for custom photo */}
      {selected === 'custom' && customThumb && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.tl, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon n="move" s={12} c={C.tl} />
            Drag to reposition
          </div>
          <div
            ref={dragRef}
            onTouchStart={e => { e.preventDefault(); handleDragStart(e.touches[0].clientX, e.touches[0].clientY); }}
            onTouchMove={e => { e.preventDefault(); handleDragMove(e.touches[0].clientX, e.touches[0].clientY); }}
            onTouchEnd={handleDragEnd}
            onMouseDown={e => { e.preventDefault(); handleDragStart(e.clientX, e.clientY); }}
            onMouseMove={e => { if (dragState.current) handleDragMove(e.clientX, e.clientY); }}
            onMouseUp={handleDragEnd}
            onMouseLeave={() => { if (dragState.current) handleDragEnd(); }}
            style={{
              width: '100%',
              height: 120,
              borderRadius: 14,
              overflow: 'hidden',
              cursor: 'grab',
              background: `url(${customThumb}) no-repeat`,
              backgroundSize: 'cover',
              backgroundPosition: `${photoPos.x}% ${photoPos.y}%`,
              border: `2px solid ${C.b}`,
              touchAction: 'none',
            }}
          />
        </div>
      )}

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
