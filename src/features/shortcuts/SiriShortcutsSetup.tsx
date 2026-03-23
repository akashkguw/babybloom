import React, { useState } from 'react';
import { C } from '@/lib/constants/colors';
import Button from '@/components/shared/Button';
import Icon from '@/components/shared/Icon';
import Card from '@/components/shared/Card';
import { fmtVol, volLabel } from '@/lib/utils/volume';

interface SiriShortcutsSetupProps {
  volumeUnit: 'ml' | 'oz';
}

export default function SiriShortcutsSetup({ volumeUnit }: SiriShortcutsSetupProps) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState('');

  const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';

  const shortcuts = [
    { name: 'Baby Breast L', icon: '🤱', param: 'quick=breast_l', desc: 'Log left breast feed' },
    { name: 'Baby Breast R', icon: '🤱', param: 'quick=breast_r', desc: 'Log right breast feed' },
    { name: 'Baby Formula', icon: '🍼', param: 'quick=bottle_4', desc: `Log formula feed (${fmtVol(4, volumeUnit)})` },
    { name: 'Baby Pumped', icon: '🤱', param: 'quick=pumped', desc: 'Log pumped breast milk' },
    { name: 'Baby Wet', icon: '💧', param: 'quick=wet', desc: 'Log wet diaper' },
    { name: 'Baby Dirty', icon: '💩', param: 'quick=dirty', desc: 'Log dirty diaper' },
    { name: 'Baby Sleep', icon: '😴', param: 'quick=sleep', desc: 'Log sleep (auto-detects nap/night)' },
    { name: 'Baby Wake', icon: '☀️', param: 'quick=wake', desc: 'Log wake up' },
    { name: 'Baby Bath', icon: '🛁', param: 'quick=bath', desc: 'Log bath time' },
    { name: 'Baby Tummy', icon: '💪', param: 'quick=tummy', desc: 'Log tummy time' },
    { name: 'Baby Massage', icon: '🤲', param: 'quick=massage', desc: 'Log massage session' },
  ];

  function copyUrl(param: string) {
    const url = baseUrl + '?' + param;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(param);
        setTimeout(() => setCopied(''), 2000);
      });
    }
  }

  return (
    <div style={{ marginTop: 16, marginBottom: 12 }}>
      <div
        onClick={() => setShow(!show)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          padding: '12px 14px',
          background: C.cd,
          borderRadius: 12,
          border: '1px solid ' + C.b,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 22 }}>⌨️</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t }}>Siri Shortcuts</div>
            <div style={{ fontSize: 11, color: C.tl }}>Log without opening the app</div>
          </div>
        </div>
        <Icon n={show ? 'chevron-up' : 'chevron-down'} s={16} c={C.tl} />
      </div>

      {show && (
        <div
          style={{
            marginTop: 8,
            background: C.cd,
            borderRadius: 12,
            padding: 14,
            border: '1px solid ' + C.b,
          }}
        >
          <div style={{ fontSize: 13, color: C.t, lineHeight: 1.6, marginBottom: 12 }}>
            Set up Siri Shortcuts to log from your iPhone home screen or by voice with "Hey Siri." Each
            shortcut opens BabyBloom for a split second, logs the action, and confirms.
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: C.s, marginBottom: 8 }}>How to set up:</div>
          <div style={{ fontSize: 12, color: C.t, lineHeight: 1.7, marginBottom: 14 }}>
            1. Tap a shortcut below to copy its URL
            <br />
            2. Open the <strong>Shortcuts</strong> app on your iPhone
            <br />
            3. Tap <strong>+</strong> → <strong>Add Action</strong> → search <strong>Open URLs</strong>
            <br />
            4. Paste the copied URL
            <br />
            5. Tap the name at top → rename to the shortcut name
            <br />
            6. Tap <strong>Done</strong> — it's now on your Shortcuts page!
            <br />
            <br />
            Say <strong>"Hey Siri, Baby Breast L"</strong> to use it hands-free.
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: C.s, marginBottom: 8 }}>Available shortcuts:</div>
          {shortcuts.map((s) => {
            const isCopied = copied === s.param;
            return (
              <div
                key={s.param}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  marginBottom: 4,
                  borderRadius: 10,
                  background: isCopied ? C.okl : C.bg,
                  transition: 'background 0.2s',
                }}
              >
                <div style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{s.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.t }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: C.tl }}>{s.desc}</div>
                </div>
                <button
                  onClick={() => copyUrl(s.param)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 8,
                    border: '1px solid ' + (isCopied ? C.ok : C.b),
                    background: isCopied ? C.ok : 'transparent',
                    color: isCopied ? 'white' : C.s,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                  }}
                >
                  {isCopied ? 'Copied!' : 'Copy URL'}
                </button>
              </div>
            );
          })}

          <div style={{ marginTop: 12, padding: 10, background: C.al, borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.a, marginBottom: 4 }}>Pro tip: Voice shortcut</div>
            <div style={{ fontSize: 11, color: C.t, lineHeight: 1.6 }}>
              Create one shortcut called <strong>"Baby Log"</strong> that uses the <strong>Dictate Text</strong>{' '}
              action, then opens:
              <br />
              <code
                style={{
                  fontSize: 10,
                  background: C.bg,
                  padding: '2px 6px',
                  borderRadius: 4,
                  wordBreak: 'break-all',
                }}
              >
                {baseUrl}?voice=[Dictated Text]
              </code>
              <br />
              This lets you say anything naturally: "Hey Siri, Baby Log" → "bottle 4 ounces"
            </div>
          </div>

          <div style={{ marginTop: 10, padding: 10, background: C.bg, borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.t, marginBottom: 4 }}>Add to Home Screen</div>
            <div style={{ fontSize: 11, color: C.tl, lineHeight: 1.6 }}>
              In the Shortcuts app, long-press any shortcut → <strong>Add to Home Screen</strong>. This gives you
              a widget-like icon that logs with a single tap.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
