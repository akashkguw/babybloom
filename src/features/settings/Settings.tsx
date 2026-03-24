import React, { useRef } from 'react';
import { C } from '@/lib/constants/colors';
import Button from '@/components/shared/Button';
import Pill from '@/components/shared/Pill';
import Icon from '@/components/shared/Icon';
import ProfileManager from '@/features/profiles/ProfileManager';
import SiriShortcutsSetup from '@/features/shortcuts/SiriShortcutsSetup';
import { today, fmtDate } from '@/lib/utils/date';
import { isValidBirthDate } from '@/lib/utils/validate';
import { toast } from '@/lib/utils/toast';
import { dga, odb, dcl, ST } from '@/lib/db/indexeddb';

interface SettingsProps {
  onClose: () => void;
  birth: string | null;
  setBirth: (date: string) => void;
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
  onShowReport?: () => void;
}

const Section = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>{title}</div>
    </div>
    <div style={{ background: C.cd, borderRadius: 16, padding: 16, border: '1px solid ' + C.b }}>
      {children}
    </div>
  </div>
);

export default function Settings({
  onClose,
  birth,
  setBirth,
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
  onShowReport,
}: SettingsProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="ca"
      style={{
        background: C.bg,
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: C.bg,
          borderBottom: '1px solid ' + C.b,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: C.cd,
            border: '1px solid ' + C.b,
            borderRadius: 10,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Icon n="arrow-left" s={18} c={C.t} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.t, margin: 0 }}>Settings</h1>
      </div>

      <div style={{ padding: '16px 16px 100px' }}>
        {/* Privacy notice */}
        <div style={{ background: C.al, borderRadius: 14, padding: '12px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon n="shield" s={18} c={C.a} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.a }}>Your Data is Local</div>
            <div style={{ fontSize: 11, color: C.tl, lineHeight: 1.4 }}>Stored on your device. Nothing sent to servers.</div>
          </div>
        </div>

        {/* Profiles */}
        {profiles && profiles.length > 0 && (
          <Section title="Profiles" icon="👶">
            <ProfileManager
              profiles={profiles}
              activeProfile={activeProfile}
              onSwitch={onSwitchProfile}
              onAdd={onAddProfile}
              onDelete={onDeleteProfile}
              onRename={onRenameProfile}
            />
          </Section>
        )}

        {/* General */}
        <Section title="General" icon="⚙️">
          {birth && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.tl, marginBottom: 4 }}>Birth Date</div>
              <input
                type="date"
                value={birth}
                max={today()}
                onChange={(e) => {
                  if (e.target.value && isValidBirthDate(e.target.value)) {
                    setBirth(e.target.value);
                  } else if (e.target.value) {
                    toast('Birth date cannot be in the future');
                  }
                }}
                style={{
                  fontSize: 14,
                  padding: '8px 12px',
                  background: C.bg,
                  borderRadius: 10,
                  color: C.t,
                  border: '1px solid ' + C.b,
                  width: '100%',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          )}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.tl, marginBottom: 6 }}>Volume Unit</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['ml', 'oz'] as const).map((u) => (
                <Pill
                  key={u}
                  label={u === 'ml' ? 'Milliliters (ml)' : 'Ounces (oz)'}
                  active={volumeUnit === u}
                  onClick={() => setVolumeUnit(u)}
                  color={C.a}
                />
              ))}
            </div>
          </div>
        </Section>

        {/* Feeding Reminders */}
        <Section title="Feeding Reminders" icon="🔔">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: reminders.enabled ? 12 : 0 }}>
            <div style={{ fontSize: 13, color: C.t }}>Enable notifications</div>
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
            <div>
              <div style={{ fontSize: 12, color: C.tl, marginBottom: 6 }}>Remind after</div>
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
        </Section>

        {/* Siri Shortcuts */}
        <Section title="Shortcuts" icon="🎙️">
          <SiriShortcutsSetup volumeUnit={volumeUnit} />
        </Section>

        {/* Data Management */}
        <Section title="Data" icon="💾">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  });
              }}
              color={C.s}
              full
            />
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
                          setTimeout(() => {
                            location.reload();
                          }, 600);
                        };
                      });
                  } catch {
                    // invalid file
                  }
                };
                r.readAsText(f);
              }}
              style={{ display: 'none' }}
            />
            <Button
              label="Generate Pediatrician Report"
              onClick={() => {
                if (onShowReport) {
                  onShowReport();
                }
              }}
              color={C.a}
              full
            />
          </div>
        </Section>

        {/* Danger Zone */}
        <Section title="Reset" icon="⚠️">
          <div style={{ fontSize: 12, color: C.tl, marginBottom: 10, lineHeight: 1.4 }}>
            This will permanently delete all profiles, logs, milestones, and vaccine records from this device.
          </div>
          <Button
            label="Reset All Data"
            onClick={() => {
              if (window.confirm('Delete ALL data?')) {
                dcl().then(() => {
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
        </Section>

        {/* Footer */}
        <div
          style={{
            textAlign: 'center',
            padding: '16px 12px',
            background: `linear-gradient(135deg, ${C.pl}, ${C.al})`,
            borderRadius: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 4 }}>💗</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.p, letterSpacing: 0.3 }}>
            Made with love for Saanvi
          </div>
          <div style={{ fontSize: 11, color: C.tl, marginTop: 2 }}>
            Every feature, crafted with care
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: C.tl }}>
          BabyBloom v2.1 — AAP/CDC/WHO 2026
        </div>
      </div>
    </div>
  );
}
