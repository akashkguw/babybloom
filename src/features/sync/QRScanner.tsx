/**
 * QRScanner — Camera-based QR code scanner.
 * Uses the native BarcodeDetector API (available in Chrome 83+, Safari 16.4+).
 * Falls back to a "paste code" prompt if BarcodeDetector is unavailable.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { C } from '@/lib/constants/colors';
import { Icon as Ic } from '@/components/shared';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

// Declare BarcodeDetector type for TypeScript
declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}

function hasBarcodeDetector(): boolean {
  return typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [supported] = useState(hasBarcodeDetector);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!supported) return;

    let detector: BarcodeDetector;
    try {
      detector = new BarcodeDetector({ formats: ['qr_code'] });
    } catch {
      setError('QR scanning not supported on this device');
      return;
    }

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scanningRef.current = true;
          scanLoop(detector);
        }
      } catch {
        setError('Camera access denied. Please allow camera access to scan QR codes.');
      }
    };

    const scanLoop = async (det: BarcodeDetector) => {
      while (scanningRef.current && videoRef.current) {
        try {
          const barcodes = await det.detect(videoRef.current);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            scanningRef.current = false;
            stopCamera();
            onScan(barcodes[0].rawValue);
            return;
          }
        } catch { /* frame not ready */ }
        await new Promise(r => setTimeout(r, 250));
      }
    };

    startCamera();
    return stopCamera;
  }, [supported, onScan, stopCamera]);

  if (!supported) {
    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
        <div style={{ fontSize: 13, color: C.t, fontWeight: 600, marginBottom: 4 }}>
          QR scanning not available
        </div>
        <div style={{ fontSize: 12, color: C.tl, marginBottom: 12 }}>
          Your browser doesn't support QR scanning. Ask your partner to share the code as text instead.
        </div>
        <button
          onClick={onClose}
          style={{
            background: C.cd, border: '1px solid ' + C.b, borderRadius: 10,
            padding: '8px 20px', fontSize: 13, color: C.t, cursor: 'pointer',
          }}
        >
          Use paste instead
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {error ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontSize: 13, color: C.t, marginBottom: 12 }}>{error}</div>
          <button
            onClick={onClose}
            style={{
              background: C.cd, border: '1px solid ' + C.b, borderRadius: 10,
              padding: '8px 20px', fontSize: 13, color: C.t, cursor: 'pointer',
            }}
          >
            Use paste instead
          </button>
        </div>
      ) : (
        <>
          <div style={{
            position: 'relative', borderRadius: 16, overflow: 'hidden',
            background: '#000', aspectRatio: '4/3',
          }}>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Scanner overlay frame */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '60%', aspectRatio: '1',
              border: '2px solid rgba(255,255,255,0.6)',
              borderRadius: 12,
            }} />
            {/* Close button */}
            <button
              onClick={() => { stopCamera(); onClose(); }}
              style={{
                position: 'absolute', top: 8, right: 8,
                background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 10,
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Ic n="x" s={18} c="white" />
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: C.tl }}>
            Point camera at the QR code on your partner's device
          </div>
        </>
      )}
    </div>
  );
}
