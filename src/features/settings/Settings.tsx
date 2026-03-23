import React, { useRef } from 'react';
import { C } from '@/lib/constants/colors';
import Button from '@/components/shared/Button';
import Pill from '@/components/shared/Pill';
import Icon from '@/components/shared/Icon';
import ProfileManager from '@/features/profiles/ProfileManager';
import SiriShortcutsSetup from '@/features/shortcuts/SiriShortcutsSetup';
import { today, daysAgo, fmtTime, fmtDate } from '@/lib/utils/date';
import { fmtVol, volLabel } from '@/lib/utils/volume';
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
              if (!w) return;

              const babyName = (profiles && profiles.find((p: any) => p.id === activeProfile))?.name || 'Baby';
              const genDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

              // Calculate age
              let ageStr = '';
              if (birth) {
                const b = new Date(birth + 'T00:00:00');
                const diffMs = Date.now() - b.getTime();
                const days = Math.floor(diffMs / 86400000);
                const months = Math.floor(days / 30.44);
                if (months < 1) ageStr = days + ' days old';
                else ageStr = months + ' month' + (months !== 1 ? 's' : '') + ' old (' + days + ' days)';
              }

              // Last 7 days stats
              const last7: string[] = [];
              for (let i = 0; i < 7; i++) last7.push(daysAgo(i));

              const feeds7 = (logs.feed || []).filter((e: any) => last7.includes(e.date));
              const sleeps7 = (logs.sleep || []).filter((e: any) => last7.includes(e.date) && e.type !== 'Wake Up' && e.type !== 'Tummy Time');
              const diapers7 = (logs.diaper || []).filter((e: any) => last7.includes(e.date));

              let totalOz = 0;
              let totalFeedMins = 0;
              feeds7.forEach((e: any) => { if (e.oz) totalOz += e.oz; if (e.mins) totalFeedMins += e.mins; });
              const avgOzDay = feeds7.length > 0 ? Math.round((totalOz / 7) * 10) / 10 : 0;
              const avgFeedsDay = Math.round((feeds7.length / 7) * 10) / 10;

              let totalSleepMins = 0;
              sleeps7.forEach((e: any) => { if (e.mins) totalSleepMins += e.mins; });
              const avgSleepHrs = Math.round((totalSleepMins / 7 / 60) * 10) / 10;

              const wetCount = diapers7.filter((e: any) => e.type === 'Wet' || e.type === 'Mixed').length;
              const dirtyCount = diapers7.filter((e: any) => e.type === 'Dirty' || e.type === 'Mixed').length;

              // Growth (latest entries)
              const growthEntries = logs.growth || [];
              const latestGrowth = growthEntries.length > 0 ? growthEntries[0] : null;

              // Recent feeds table (last 10)
              const recentFeeds = (logs.feed || []).slice(0, 10);
              let feedRows = '';
              recentFeeds.forEach((e: any) => {
                feedRows += '<tr><td>' + fmtDate(e.date) + '</td><td>' + fmtTime(e.time) + '</td><td>' + (e.type || '') + '</td><td>' + (e.amount || '') + '</td></tr>';
              });

              // Milestone count
              let milestoneTotal = 0;
              let milestoneDone = 0;
              if (checked) {
                Object.keys(checked).forEach((k: string) => {
                  const group = checked[k];
                  if (group && typeof group === 'object') {
                    Object.values(group).forEach((v: any) => {
                      milestoneTotal++;
                      if (v) milestoneDone++;
                    });
                  }
                });
              }

              // Vaccine count
              let vaccinesDone = 0;
              if (vDone) {
                Object.values(vDone).forEach((v: any) => { if (v) vaccinesDone++; });
              }

              const vUnit = volLabel(volumeUnit);

              w.document.write(
                '<html><head><title>BabyBloom Health Report — ' + babyName + '</title><style>' +
                'body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:650px;margin:40px auto;padding:20px;color:#333;line-height:1.6;font-size:14px}' +
                'h1{color:#FF6B8A;border-bottom:2px solid #FF6B8A;padding-bottom:8px;font-size:22px}' +
                'h2{color:#6C63FF;margin-top:24px;font-size:16px;border-bottom:1px solid #eee;padding-bottom:4px}' +
                '.info{font-size:13px;color:#666;margin-bottom:4px}' +
                '.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:12px 0}' +
                '.box{background:#f8f4ef;padding:14px;border-radius:10px;text-align:center}' +
                '.box b{display:block;font-size:22px;color:#333;margin-bottom:2px}' +
                '.box span{font-size:11px;color:#888}' +
                'table{width:100%;border-collapse:collapse;margin:8px 0}' +
                'th{text-align:left;padding:6px 8px;border-bottom:2px solid #ddd;font-size:12px;color:#666;text-transform:uppercase}' +
                'td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee;font-size:13px}' +
                '.notes{border:1px dashed #ccc;padding:20px;border-radius:8px;min-height:80px;color:#888;margin:8px 0}' +
                '@media print{body{margin:0;padding:10px}.grid{break-inside:avoid}}</style></head><body>' +
                '<h1>BabyBloom Health Report</h1>' +
                '<p class="info"><b style="font-size:16px;color:#333">' + babyName + '</b></p>' +
                (ageStr ? '<p class="info">Age: ' + ageStr + '</p>' : '') +
                (birth ? '<p class="info">Birth date: ' + fmtDate(birth) + '</p>' : '') +
                '<p class="info">Report generated: ' + genDate + '</p>' +

                '<h2>7-Day Summary</h2>' +
                '<div class="grid">' +
                '<div class="box"><b>' + feeds7.length + '</b><span>Feedings</span></div>' +
                '<div class="box"><b>' + (avgOzDay > 0 ? fmtVol(avgOzDay, volumeUnit) : avgFeedsDay + '/day') + '</b><span>' + (avgOzDay > 0 ? 'Avg ' + vUnit + '/day' : 'Avg per day') + '</span></div>' +
                '<div class="box"><b>' + (totalFeedMins > 0 ? Math.round(totalFeedMins / 7) + 'm' : '—') + '</b><span>Avg feed min/day</span></div>' +
                '</div>' +
                '<div class="grid">' +
                '<div class="box"><b>' + avgSleepHrs + 'h</b><span>Avg sleep/day</span></div>' +
                '<div class="box"><b>' + wetCount + '</b><span>Wet diapers (7d)</span></div>' +
                '<div class="box"><b>' + dirtyCount + '</b><span>Dirty diapers (7d)</span></div>' +
                '</div>' +

                (latestGrowth ? (
                  '<h2>Latest Growth</h2>' +
                  '<div class="grid">' +
                  (latestGrowth.weight ? '<div class="box"><b>' + latestGrowth.weight + '</b><span>Weight</span></div>' : '') +
                  (latestGrowth.height ? '<div class="box"><b>' + latestGrowth.height + '</b><span>Height</span></div>' : '') +
                  (latestGrowth.head ? '<div class="box"><b>' + latestGrowth.head + '</b><span>Head circ.</span></div>' : '') +
                  '</div>' +
                  '<p class="info">Recorded: ' + fmtDate(latestGrowth.date) + '</p>'
                ) : '') +

                '<h2>Milestones & Vaccines</h2>' +
                '<div class="grid">' +
                '<div class="box"><b>' + milestoneDone + '</b><span>Milestones done</span></div>' +
                '<div class="box"><b>' + vaccinesDone + '</b><span>Vaccines done</span></div>' +
                '<div class="box"><b>' + (milestoneTotal > 0 ? Math.round((milestoneDone / milestoneTotal) * 100) + '%' : '—') + '</b><span>Progress</span></div>' +
                '</div>' +

                (feedRows ? (
                  '<h2>Recent Feedings</h2>' +
                  '<table><tr><th>Date</th><th>Time</th><th>Type</th><th>Amount</th></tr>' +
                  feedRows +
                  '</table>'
                ) : '') +

                '<h2>Notes for Pediatrician</h2>' +
                '<div class="notes" contenteditable="true">Click here to type notes before your visit...</div>' +

                '<div style="text-align:center;margin-top:30px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:12px">' +
                'Generated by BabyBloom — Based on AAP, CDC & WHO guidelines — ' + genDate +
                '</div></body></html>'
              );
              w.document.close();
              setTimeout(() => { w.print(); }, 500);
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

        {/* Ko-fi support */}
        <div
          style={{
            marginTop: 24,
            padding: '16px',
            background: C.cd,
            borderRadius: 16,
            border: `1px solid ${C.b}`,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 18, marginBottom: 6 }}>☕</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t, marginBottom: 4 }}>
            Enjoying BabyBloom?
          </div>
          <div style={{ fontSize: 12, color: C.tl, marginBottom: 12, lineHeight: 1.5 }}>
            Free, no ads, no tracking. If it's helped during those sleepless nights, a small coffee keeps it going.
          </div>
          <div
            onClick={() => window.open('https://ko-fi.com/babybloom', '_blank')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 24px',
              borderRadius: 12,
              background: '#FF5E5B',
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span>☕</span>
            <span>Buy me a coffee</span>
          </div>
          <div style={{ fontSize: 10, color: C.tl, marginTop: 8 }}>
            No account needed · One-time · Any amount
          </div>
        </div>

        <div
          style={{
            textAlign: 'center',
            marginTop: 16,
            padding: '16px 12px',
            background: `linear-gradient(135deg, ${C.pl}, ${C.al})`,
            borderRadius: 16,
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

        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: C.tl }}>
          BabyBloom v2.1 — AAP/CDC/WHO 2026
        </div>
      </div>
    </div>
  );
}
