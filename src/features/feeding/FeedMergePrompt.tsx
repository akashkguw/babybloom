import React from 'react';
import { C } from '@/lib/constants/colors';
import { fmtTime, today, now } from '@/lib/utils/date';

interface MergePromptData {
  mins: number;
  type: string;
  recent: {
    type: string;
    amount?: string;
    mins?: number;
    time: string;
    [key: string]: any;
  };
}

interface FeedMergePromptProps {
  data: MergePromptData | null;
  onMerge: () => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

export default function FeedMergePrompt({
  data,
  onMerge,
  onCreateNew,
  onCancel,
}: FeedMergePromptProps) {
  if (!data) return null;

  const totalMins = (data.recent.mins || 0) + data.mins;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 250,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: C.cd,
          borderRadius: 20,
          padding: '28px 24px',
          maxWidth: 340,
          width: '88%',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>🍼</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.t, marginBottom: 6 }}>
          {data.type} — {data.mins} min
        </div>
        <div style={{ fontSize: 13, color: C.tl, marginBottom: 16, lineHeight: 1.5 }}>
          Last feed was{' '}
          <strong>
            {data.recent.type} ({data.recent.amount || '?'})
          </strong>{' '}
          at <strong>{fmtTime(data.recent.time)}</strong>. Same session?
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onMerge}
            style={{
              padding: '14px 20px',
              borderRadius: 14,
              background: C.s,
              color: 'white',
              border: 'none',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Add to previous feed ({totalMins} min total)
          </button>
          <button
            onClick={onCreateNew}
            style={{
              padding: '12px 20px',
              borderRadius: 14,
              background: C.bg,
              border: '1px solid ' + C.b,
              color: C.t,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Log as separate feed
          </button>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: C.tl,
              fontSize: 13,
              cursor: 'pointer',
              padding: 8,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
