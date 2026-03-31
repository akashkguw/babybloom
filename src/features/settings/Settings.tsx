import React from 'react';
import { C } from '@/lib/constants/colors';
import Button from '@/components/shared/Button';
import Pill from '@/components/shared/Pill';
import Icon from '@/components/shared/Icon';
import ProfileManager from '@/features/profiles/ProfileManager';
import SiriShortcutsSetup from '@/features/shortcuts/SiriShortcutsSetup';
import HeroBackgroundPicker from '@/features/settings/HeroBackgroundPicker';
import { today } from '@/lib/utils/date';
import { isValidBirthDate } from '@/lib/utils/validate';
import { toast } from '@/lib/utils/toast';
import { dcl } from '@/lib/db/indexeddb';
import { getAvailableCountries } from '@/lib/constants/countries';
import type { CountryCode, CountryConfig } from '@/lib/constants/countries';
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
  onSync?: () => void;
  onCloudSync?: () => void;
  onShowGuide?: () => void;
  country: CountryCode;
  setCountry: (code: CountryCode) => void;
  countryConfig: CountryConfig;
  onHeroBgChange?: (bg: any) => void;
}

/* Section with Icon-based header — professional, consistent iconography */
const Section = ({ title, iconName, iconColor, children }: {
  title: string;
  iconName: string;
  iconColor?: string;
  children: React.ReactNode;
}) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <Icon n={iconName} s={16} c={iconColor || C.tl} />
      <div style={{ fontSize: 14, fontWeight: 700, color: C.t }}>{title}</div>
    </div>
    <div style={{ background: C.cd, borderRadius: 14, padding: 14, border: '1px solid ' + C.b }}>
      {children}
    </div>
  </div>
);

/* Group label for visual hierarchy */
const GroupLabel = ({ label }: { label: string }) => (
  <div style={{
    fontSize: 11,
    fontWeight: 700,
    color: C.tl,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
    paddingLeft: 2,
  }}>
    {label}
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
  logs: _logs,
  checked: _checked,
  vDone: _vDone,
  reminders,
  setReminders,
  volumeUnit,
  setVolumeUnit,
  onShowReport,
  onSync,
  onCloudSync,
  onShowGuide,
  country,
  setCountry,
  countryConfig,
  onHeroBgChange,
}: SettingsProps) {
  const countries = getAvailableCountries();

  return (
    <div
      className="ca"
      style={{
        background: C.bg,
      }}
    >
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          background: C.bg,
          borderBottom: '1px solid ' + C.b,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
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
        <Icon n="settings" s={20} c={C.p} />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.t, margin: 0 }}>Settings</h1>
      </div>

      <div style={{ padding: '16px 16px 100px' }}>
        {/* Privacy notice */}
        <div style={{ background: C.al, borderRadius: 14, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon n="shield" s={16} c={C.a} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.a }}>Your Data is Local</div>
            <div style={{ fontSize: 11, color: C.tl, lineHeight: 1.4 }}>Stored on your device. Nothing sent to servers.</div>
          </div>
        </div>

        {/* ─── Group: Profile & Region ─── */}
        {profiles && profiles.length > 0 && (
          <>
            <GroupLabel label="Profile & Region" />

            <Section title="Profiles" iconName="users" iconColor={C.p}>
              <ProfileManager
                profiles={profiles}
                activeProfile={activeProfile}
                onSwitch={onSwitchProfile}
                onAdd={onAddProfile}
                onDelete={onDeleteProfile}
                onRename={onRenameProfile}
              />
            </Section>
          </>
        )}

        <Section title="Country" iconName="home" iconColor={C.a}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.tl, marginBottom: 8 }}>
            Select your country for localized guidelines, vaccines & emergency numbers
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {countries.map((c) => (
              <div
                key={c.code}
                onClick={() => setCountry(c.code)}
                style={{
                  flex: '1 1 45%',
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: `2px solid ${country === c.code ? C.a : C.b}`,
                  background: country === c.code ? C.al : C.bg,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: 22 }}>{c.flag}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: C.tl }}>
                    {c.code === 'US' ? 'AAP/CDC guidelines' : c.code === 'IN' ? 'IAP guidelines' : ''}
                  </div>
                </div>
                {country === c.code && (
                  <Icon n="check" s={16} c={C.a} st={{ marginLeft: 'auto' }} />
                )}
              </div>
            ))}
          </div>
          {countryConfig && (
            <div style={{ marginTop: 8, fontSize: 11, color: C.tl, lineHeight: 1.4 }}>
              Using {countryConfig.medical.authorityFull} ({countryConfig.medical.authority}) guidelines
              {' \u00B7 '}Emergency: {countryConfig.emergency.primaryNumber}
              {' \u00B7 '}Vaccines: {countryConfig.vaccineSource}
            </div>
          )}
        </Section>

        {/* ─── Group: Preferences ─── */}
        <GroupLabel label="Preferences" />

        <Section title="General" iconName="settings" iconColor={C.s}>
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

        <Section title="Hero Background" iconName="palette" iconColor={C.pu}>
          <HeroBackgroundPicker onChange={onHeroBgChange} />
        </Section>

        <Section title="Feeding Reminders" iconName="bell" iconColor={C.w}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, color: C.t }}>Enable smart reminders</div>
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
          <div style={{ fontSize: 11, color: C.tl, marginTop: 8, lineHeight: 1.5 }}>
            {reminders.enabled
              ? 'Reminders automatically adjust based on your baby\'s age — more frequent for newborns, less as they grow.'
              : 'When enabled, you\'ll get age-appropriate feeding reminders that adjust automatically as your baby grows.'}
          </div>
        </Section>

        <Section title="Shortcuts" iconName="mic" iconColor={C.bl}>
          <SiriShortcutsSetup volumeUnit={volumeUnit} />
        </Section>

        {/* ─── Group: Data & Support ─── */}
        <GroupLabel label="Data & Support" />

        <Section title="Share & Reports" iconName="database" iconColor={C.s}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button
              label="☁️ Google Drive Sync"
              onClick={() => { if (onCloudSync) onCloudSync(); }}
              color={C.bl}
              full
            />
            <Button
              label="Share Data with Partner"
              onClick={() => { if (onSync) onSync(); }}
              color={C.s}
              full
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

        <Section title="Guide" iconName="book" iconColor={C.s}>
          <div style={{ fontSize: 12, color: C.tl, marginBottom: 10, lineHeight: 1.4 }}>
            Revisit the app walkthrough — learn about quick logging, smart alerts, wellness tracking, and more.
          </div>
          <Button
            label="View Guide"
            onClick={() => { if (onShowGuide) onShowGuide(); }}
            color={C.s}
            full
          />
        </Section>

        <Section title="Reset" iconName="alert-triangle" iconColor="#FF5252">
          <div style={{ fontSize: 12, color: C.tl, marginBottom: 10, lineHeight: 1.4 }}>
            This will permanently delete all profiles, logs, milestones, and vaccine records from this device.
          </div>
          <div style={{
            background: C.al, borderRadius: 12, padding: '10px 12px', marginBottom: 12,
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <Icon n="info" s={16} c={C.a} st={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 11, color: C.t, lineHeight: 1.5 }}>
              <strong>Before resetting:</strong> Go to <span style={{ color: C.s, fontWeight: 600 }}>Sync / Share Data</span> above
              and generate a full sync QR code. Save it somewhere safe — you can use it to restore your data later or share with a partner.
            </div>
          </div>
          <Button
            label="Reset All Data"
            onClick={() => {
              if (window.confirm('Have you saved your sync code? This will delete ALL data and cannot be undone.')) {
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
          BabyBloom v2.1 — {countryConfig.medical.authority}/WHO 2026
        </div>
      </div>
    </div>
  );
}
