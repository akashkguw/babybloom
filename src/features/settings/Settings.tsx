import React, { useRef } from 'react';
import { C } from '@/lib/constants/colors';
import Button from '@/components/shared/Button';
import Pill from '@/components/shared/Pill';
import Icon from '@/components/shared/Icon';
import ProfileManager from '@/features/profiles/ProfileManager';
import SiriShortcutsSetup from '@/features/shortcuts/SiriShortcutsSetup';
import { today } from '@/lib/utils/date';
import { dga, odb, dcl, ST } from '@/lib/db/indexeddb';

interface SettingsProps {
  onClose: () => void;
  birth: string | null;
  profiles: any[];
  activeProfile: number | null;
  onSwitchProfile: (id: number) => void;
  onAddProfile: (profile: any) => void;
  onDeleteProfile: (id: number) => void;
  onRenameProfile: (id: number, name: string) => void;
  logs: any;
  checked: any;
  vDone: any;
  reminders: any;
  setReminders: (reminders: any) => void;
  volumeUnit: 'ml' | 'oz';
  setVolumeUnit: (unit: 'ml' | 'oz') => void;
}

export default function Settings({
  onClose,
  birth,
  profiles,
  activeProfile,
  onSwitchProfile,
  onAddProfile,
  onDeleteProfile,
  onRenameProfile,
  logs,
  checked,
  vDone,
  reminders,
  setReminders,
  volumeUnit,
  setVolumeUnit,
}: SettingsProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="mo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ms">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Settings & Data</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <Icon n="x" s={22} c={C.tl} />
          </button>
        </div>

        <div style={{ background: C.al, borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Your Data is Local</div>
          <div style={{ fontSize: 12, color: C.t, lineHeight: 1.5 }}>
            All data stored in IndexedDB on your device. Nothing sent to servers.
          </div>
        </div>

        {profiles && profiles.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <ProfileManager
              profiles={profiles}
              activeProfile={activeProfile}
              onSwitch={onSwitchProfile}
              onAdd={onAddProfile}
              onDelete={onDeleteProfile}
              onRename={onRenameProfile}
            />
          </div>
        )}

        {birth && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.tl, marginBottom: 4 }}>Birth Date</div>
            <div style={{ fontSize: 15, padding: '8px 12px', background: C.bg, borderRadius: 10 }}>
              {new Date(birth + 'T00:00:00').toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t, marginBottom: 8 }}>Feeding Reminders</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1, fontSize: 13, color: C.t }}>Enable notifications</div>
            <button
              onClick={() => {
                if (!reminders.enabled && 'Notification' in window) {
                  (Notification as any).requestPermission();
                }
                setReminders({ ...reminders, enabled: !reminders.enabled });
              }}
              style={{
                width: 50,
                height: 28,
                borderRadius: 14,
                border: 'none',
                background: reminders.enabled ? C.ok : C.b,
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: C.cd,
                  position: 'absolute',
                  top: 2,
                  left: reminders.enabled ? 24 : 2,
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
            </button>
          </div>
          {reminders.enabled && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: C.tl, marginBottom: 4 }}>Remind after (hours)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[2, 2.5, 3, 4].map((hr) => (
                  <Pill
                    key={hr}
                    label={hr + 'h'}
                    active={reminders.feedInterval === hr}
                    onClick={() => setReminders({ ...reminders, feedInterval: hr })}
                    color={C.a}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t, marginBottom: 8 }}>Volume Unit</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['ml', 'oz'].map((u) => (
              <Pill
                key={u}
                label={u === 'ml' ? 'Milliliters (ml)' : 'Ounces (oz)'}
                active={volumeUnit === u}
                onClick={() => setVolumeUnit(u as 'ml' | 'oz')}
                color={C.a}
              />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <Button
            label="Export Backup"
            onClick={() => {
              dga()
                .then((d: any) => {
                  const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
                  const u = URL.createObjectURL(b);
                  const a = document.createElement('a');
                  a.href = u;
                  a.download = 'babybloom-backup-' + today() + '.json';
                  a.click();
                  URL.revokeObjectURL(u);
                  // toast('Saved!');
                });
            }}
            color={C.s}
            full
          />
          <div style={{ height: 8 }} />
          <Button
            label="Import Backup"
            onClick={() => fileRef.current?.click()}
            color={C.s}
            outline
            full
          />
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const r = new FileReader();
              r.onload = (ev) => {
                try {
                  const d = JSON.parse(ev.target?.result as string);
                  odb()
                    .then((db: any) => {
                      const tx = db.transaction(ST, 'readwrite');
                      const s = tx.objectStore(ST);
                      s.clear();
                      Object.entries(d).forEach(([k, v]: any) => {
                        s.put({ key: k, value: v });
                      });
                      tx.oncomplete = () => {
                        // toast('Restored!');
                        setTimeout(() => {
                          location.reload();
                        }, 600);
                      };
                    });
                } catch (err) {
                  // toast('Invalid file');
                }
              };
              r.readAsText(f);
            }}
            style={{ display: 'none' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <Button
            label="Generate Pediatrician Report"
            onClick={() => {
              const w = window.open('', '_blank');
              if (w) {
                w.document.write(
                  '<html><head><title>BabyBloom Report</title><style>' +
                    'body{font-family:-apple-system,sans-serif;max-width:600px;margin:40px auto;padding:20px;color:#333;line-height:1.6}' +
                    'h1{color:#FF6B8A;border-bottom:2px solid #FF6B8A;padding-bottom:8px}' +
                    'h2{color:#6C63FF;margin-top:20px;font-size:16px}' +
                    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}' +
                    '.box{background:#f8f4ef;padding:12px;border-radius:8px}' +
                    '.box b{display:block;font-size:20px;color:#333}' +
                    '.box span{font-size:12px;color:#888}' +
                    'table{width:100%;border-collapse:collapse;margin:8px 0}th,td{text-align:left;padding:6px;border-bottom:1px solid #eee;font-size:13px}' +
                    '@media print{body{margin:0}}</style></head><body>' +
                    '<h1>🌸 BabyBloom Health Report</h1>' +
                    '<p><b>' +
                    (profiles && profiles.find((p: any) => p.id === activeProfile))?.name ||
                    'Baby' +
                    '</b> — Generated: ' +
                    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) +
                    '</p>' +
                    '<h2>Notes for Pediatrician</h2><p style="border:1px dashed #ccc;padding:20px;border-radius:8px;min-height:80px;color:#888">Write notes here before your visit...</p>' +
                    '<div style="text-align:center;margin-top:30px;font-size:11px;color:#aaa">Generated by BabyBloom — AAP/CDC/WHO 2026</div>' +
                    '</body></html>'
                );
                w.document.close();
                setTimeout(() => {
                  w.print();
                }, 500);
              }
            }}
            color={C.a}
            full
          />
        </div>

        <SiriShortcutsSetup volumeUnit={volumeUnit} />

        <div style={{ marginTop: 12 }}>
          <Button
            label="Reset All Data"
            onClick={() => {
              if (window.confirm('Delete ALL data?')) {
                dcl().then(() => {
                  // toast('Cleared');
                  setTimeout(() => {
                    location.reload();
                  }, 500);
                });
              }
            }}
            color="#FF5252"
            outline
            full
          />
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: C.tl }}>
          BabyBloom v2.1 — AAP/CDC/WHO 2026
        </div>
      </div>
    </div>
  );
}
