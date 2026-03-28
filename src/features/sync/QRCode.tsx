/**
 * QRCode display component.
 * Renders a QR code matrix as an SVG.
 */
import { useMemo } from 'react';
import { generateQR } from '@/lib/utils/qr';

interface QRCodeProps {
  data: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
}

export default function QRCode({ data, size = 200, fgColor = '#000', bgColor = '#fff' }: QRCodeProps) {
  const matrix = useMemo(() => generateQR(data), [data]);

  if (!matrix) {
    return (
      <div style={{
        width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: bgColor, borderRadius: 12, fontSize: 12, color: '#999', textAlign: 'center', padding: 16,
      }}>
        Data too large for QR code. Use copy/paste instead.
      </div>
    );
  }

  const modules = matrix.length;
  const quiet = 2; // Quiet zone modules
  const total = modules + quiet * 2;
  const moduleSize = size / total;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      style={{ borderRadius: 8 }}
    >
      <rect x="0" y="0" width={total} height={total} fill={bgColor} />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c + quiet}
              y={r + quiet}
              width={1}
              height={1}
              fill={fgColor}
            />
          ) : null
        )
      )}
    </svg>
  );
}
