import React from 'react';
import useVoiceRecognition from './useVoiceRecognition';
import { VoiceParseResult } from './parseVoice';
import { C } from '@/lib/constants/colors';
import Icon from '@/components/shared/Icon';

interface VoiceButtonProps {
  onResult?: (parsed: VoiceParseResult) => void;
  quickLog: (cat: string, entry: Record<string, any>) => void;
  babyName?: string;
}

export default function VoiceButton({ onResult, quickLog, babyName }: VoiceButtonProps) {
  const { startListening, cancelVoice, confirmNow, listenState, transcript, parsed, err, supported } = useVoiceRecognition(
    (parsed) => {
      if (onResult) onResult(parsed);
      else quickLog(parsed.cat, parsed.entry);
    }
  );

  if (!supported) return null;

  const catLabels: Record<string, string> = {
    feed: 'Feeding',
    diaper: 'Diaper',
    sleep: 'Sleep',
    temp: 'Temperature',
    bath: 'Bath',
    massage: 'Massage',
    meds: 'Medicine',
    allergy: 'Allergy',
    growth: 'Growth',
  };

  return (
    <>
      {/* Floating mic button */}
      {listenState === 'idle' && !parsed && (
        <button
          onClick={startListening}
          style={{
            position: 'fixed',
            bottom: 100,
            right: 16,
            zIndex: 99,
            width: 56,
            height: 56,
            borderRadius: 28,
            background: `linear-gradient(135deg,${C.p},${C.s})`,
            border: 'none',
            boxShadow: '0 4px 16px rgba(139,92,246,0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s',
          }}
          onMouseDown={(e) => {
            (e.currentTarget as any).style.transform = 'scale(0.9)';
          }}
          onMouseUp={(e) => {
            (e.currentTarget as any).style.transform = 'scale(1)';
          }}
        >
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1={12} y1={19} x2={12} y2={23} />
            <line x1={8} y1={23} x2={16} y2={23} />
          </svg>
        </button>
      )}

      {/* Listening overlay */}
      {listenState === 'listening' && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            top: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: 100,
          }}
        >
          <div
            style={{
              background: C.cd,
              borderRadius: 24,
              padding: '32px 28px',
              maxWidth: 340,
              width: '90%',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12, animation: 'pulse 1.5s infinite' }}>🎙️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.t, marginBottom: 6 }}>Listening...</div>
            <div style={{ fontSize: 13, color: C.tl, marginBottom: 12 }}>
              {transcript || 'Say something like "bottle 4 oz" or "pee diaper"'}
            </div>
            <div style={{ fontSize: 12, color: C.tl, marginBottom: 16 }}>
              Examples: breast left 15 min, poop diaper, nap, woke up, temp 99.5
            </div>
            <button
              onClick={cancelVoice}
              style={{
                padding: '10px 24px',
                borderRadius: 12,
                background: C.b,
                border: 'none',
                color: C.t,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirmation overlay */}
      {parsed && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            top: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: 100,
          }}
        >
          <div
            style={{
              background: C.cd,
              borderRadius: 24,
              padding: '28px 24px',
              maxWidth: 340,
              width: '90%',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t, marginBottom: 4 }}>Got it!</div>
            <div style={{ fontSize: 14, color: C.s, fontWeight: 600, marginBottom: 4 }}>{catLabels[parsed.cat] || parsed.cat}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.t, marginBottom: 4 }}>
              {parsed.entry.type}
              {parsed.entry.amount ? ` — ${parsed.entry.amount}` : ''}
            </div>
            {parsed.entry.notes && <div style={{ fontSize: 12, color: C.tl, marginBottom: 4 }}>{parsed.entry.notes}</div>}
            <div style={{ fontSize: 12, color: C.tl, marginBottom: 16, fontStyle: 'italic' }}>"{transcript}"</div>
            <div style={{ fontSize: 11, color: C.ok, marginBottom: 12 }}>Auto-saving in 2s...</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={confirmNow}
                style={{
                  padding: '10px 24px',
                  borderRadius: 12,
                  background: C.ok,
                  border: 'none',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Save Now
              </button>
              <button
                onClick={cancelVoice}
                style={{
                  padding: '10px 20px',
                  borderRadius: 12,
                  background: C.b,
                  border: 'none',
                  color: C.t,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {err && (
        <div
          style={{
            position: 'fixed',
            bottom: 164,
            left: 16,
            right: 16,
            zIndex: 200,
            padding: '12px 16px',
            borderRadius: 12,
            background: C.pl,
            color: C.p,
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
            cursor: 'pointer',
          }}
          onClick={() => null}
        >
          {err}
        </div>
      )}
    </>
  );
}
