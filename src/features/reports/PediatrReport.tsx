/**
 * Pediatrician Report Generator
 * One-tap PDF-style report summarizing the baby's recent data
 * in a format pediatricians actually want to see.
 *
 * Generates a printable HTML page that can be saved as PDF
 * via the browser's print dialog.
 */
import { useState, useCallback, useRef } from 'react';
import { C } from '@/lib/constants/colors';
import { Button as Btn, Icon as Ic } from '@/components/shared';
import { toast } from '@/lib/utils/toast';
import { today, fmtDate, fmtTime, daysAgo } from '@/lib/utils/date';
import { fmtVol } from '@/lib/utils/volume';
import type { CountryConfig } from '@/lib/constants/countries';

interface LogEntry {
  id: number;
  date: string;
  time: string;
  type: string;
  mins?: number;
  oz?: number;
  amount?: string;
  notes?: string;
}

interface Logs {
  feed?: LogEntry[];
  diaper?: LogEntry[];
  sleep?: LogEntry[];
  growth?: LogEntry[];
  temp?: LogEntry[];
  bath?: LogEntry[];
  meds?: LogEntry[];
  allergy?: LogEntry[];
  [key: string]: LogEntry[] | undefined;
}

interface PediatrReportProps {
  logs: Logs;
  babyName: string;
  birth: string | null;
  age: number;
  vDone: { [key: string]: boolean };
  volumeUnit: 'ml' | 'oz';
  onClose: () => void;
  countryConfig: CountryConfig;
}

type ReportPeriod = '7' | '14' | '30';

function entriesInRange(entries: LogEntry[], days: number): LogEntry[] {
  const cutoff = daysAgo(days);
  return entries.filter((e) => e.date >= cutoff);
}

export default function PediatrReport({
  logs, babyName, birth, age, vDone, volumeUnit, onClose, countryConfig,
}: PediatrReportProps) {
  const VACCINES = countryConfig.vaccines;
  const [period, setPeriod] = useState<ReportPeriod>('7');
  const [generating, setGenerating] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const generateReport = useCallback(() => {
    setGenerating(true);
    const days = parseInt(period);
    const td = today();
    const startDate = daysAgo(days);

    // ─── Feeding summary ───
    const feeds = entriesInRange(logs.feed || [], days);
    const feedDays = new Set(feeds.map((e) => e.date)).size;
    const avgFeedsPerDay = feedDays > 0 ? Math.round((feeds.length / feedDays) * 10) / 10 : 0;
    const breastFeeds = feeds.filter((e) => e.type?.startsWith('Breast'));
    const bottleFeeds = feeds.filter((e) => e.type === 'Formula' || e.type === 'Pumped Milk');
    const solidFeeds = feeds.filter((e) => e.type === 'Solids');
    let totalOz = 0;
    bottleFeeds.forEach((e) => { totalOz += e.oz || 0; });
    let totalBreastMin = 0;
    breastFeeds.forEach((e) => { totalBreastMin += e.mins || 0; });

    // ─── Diaper summary ───
    const diapers = entriesInRange(logs.diaper || [], days);
    const diaperDays = new Set(diapers.map((e) => e.date)).size;
    const avgDiapersPerDay = diaperDays > 0 ? Math.round((diapers.length / diaperDays) * 10) / 10 : 0;
    const wetCount = diapers.filter((e) => e.type === 'Wet' || e.type === 'Both').length;
    const dirtyCount = diapers.filter((e) => e.type === 'Dirty' || e.type === 'Both').length;

    // ─── Sleep summary ───
    const allSleepEntries = entriesInRange(logs.sleep || [], days);
    const sleepsWithMins = allSleepEntries.filter((e) => e.mins);
    let totalSleepMins = 0;
    sleepsWithMins.forEach((e) => { totalSleepMins += e.mins || 0; });
    const sleepDays = new Set(sleepsWithMins.map((e) => e.date)).size || 1;
    const avgSleepHrs = Math.round((totalSleepMins / sleepDays / 60) * 10) / 10;
    // Count naps/nights from all sleep entries (not just those with mins,
    // since mins is set on the Wake Up entry, not the Nap/Night Sleep entry)
    const naps = allSleepEntries.filter((e) => e.type === 'Nap');
    const nights = allSleepEntries.filter((e) => e.type === 'Night Sleep');

    // ─── Growth ───
    const growth = (logs.growth || []).sort((a, b) => b.date.localeCompare(a.date));
    const latestGrowth = growth.length > 0 ? growth[0] : null;
    const prevGrowth = growth.length > 1 ? growth[1] : null;

    // ─── Temperature ───
    const temps = entriesInRange(logs.temp || [], days);
    const highTemps = temps.filter((e) => {
      const val = parseFloat(e.amount || '0');
      return val >= 100.4 || val >= 38;
    });

    // ─── Meds ───
    const meds = entriesInRange(logs.meds || [], days);
    const medTypes = [...new Set(meds.map((e) => e.type))];

    // ─── Allergies ───
    const allergies = logs.allergy || [];
    const reactions = allergies.filter((e) => e.notes && e.notes.toLowerCase().includes('reaction'));

    // ─── Vaccines ───
    const completedVaccines: string[] = [];
    const pendingVaccines: string[] = [];
    const ageMonths = Math.floor(age);
    const ageToMonths: { [key: string]: number } = (() => {
      const map: { [key: string]: number } = { Birth: 0 };
      VACCINES.forEach((v) => {
        const a = v.age;
        if (a === 'Birth') return;
        const weekMatch = a.match(/(\d+)\s*weeks?/i);
        if (weekMatch) { map[a] = Math.round(parseInt(weekMatch[1]) / 4.33 * 10) / 10; return; }
        const moMatch = a.match(/(\d+)/);
        if (moMatch) { map[a] = parseInt(moMatch[1]); }
      });
      return map;
    })();
    VACCINES.forEach((group, ai) => {
      const dueAt = ageToMonths[group.age] ?? 99;
      if (dueAt > ageMonths + 1) return;
      group.v.forEach((v, vi) => {
        const key = ai + '_' + vi;
        if (vDone[key]) completedVaccines.push(v.n);
        else pendingVaccines.push(v.n + ' (due ' + group.age + ')');
      });
    });

    // ─── Format age ───
    const ageDays = Math.round(age * 30.44);
    const ageStr = age < 1
      ? ageDays + ' days'
      : age < 2
        ? Math.floor(ageDays / 7) + ' weeks'
        : Math.floor(age) + ' months';

    // ─── Build HTML report ───
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>BabyBloom Report - ${babyName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2D2D3A; padding: 24px; max-width: 700px; margin: 0 auto; line-height: 1.5; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 15px; color: #6C63FF; margin: 18px 0 8px; border-bottom: 2px solid #E8E6FF; padding-bottom: 4px; }
  .meta { color: #8E8E9A; font-size: 12px; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
  .stat { background: #F8F8FC; border-radius: 8px; padding: 10px 14px; }
  .stat-label { font-size: 11px; color: #8E8E9A; }
  .stat-value { font-size: 18px; font-weight: 700; }
  .flag { background: #FFF3E0; border-left: 3px solid #FFB347; padding: 8px 12px; border-radius: 6px; margin: 6px 0; font-size: 12px; }
  .good { background: #E8F5E9; border-left: 3px solid #4CAF50; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
  th { text-align: left; padding: 6px 8px; background: #F8F8FC; font-weight: 600; }
  td { padding: 6px 8px; border-bottom: 1px solid #F0EBE3; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #F0EBE3; font-size: 10px; color: #8E8E9A; text-align: center; }
  @media print { body { padding: 12px; } .no-print { display: none; } }
</style>
</head><body>
<div class="no-print" style="margin-bottom:16px;padding:10px 14px;background:#E8E6FF;border-radius:8px;font-size:13px;color:#6C63FF">
  <strong>Tip:</strong> Use your browser's Print (Ctrl+P / Cmd+P) to save as PDF for your pediatrician.
</div>
<h1>🍼 ${babyName} — Care Report</h1>
<div class="meta">
  Age: ${ageStr} · Born: ${birth ? fmtDate(birth) : 'Not set'} · Period: ${fmtDate(startDate)} – ${fmtDate(td)} (${days} days)<br>
  Generated: ${new Date().toLocaleDateString()} via BabyBloom
</div>

<h2>🍼 Feeding</h2>
<div class="grid">
  <div class="stat"><div class="stat-label">Avg feeds/day</div><div class="stat-value">${avgFeedsPerDay}</div></div>
  <div class="stat"><div class="stat-label">Total feeds</div><div class="stat-value">${feeds.length}</div></div>
</div>
<table>
  <tr><th>Type</th><th>Count</th><th>Total</th></tr>
  ${breastFeeds.length > 0 ? `<tr><td>Breastfeeding</td><td>${breastFeeds.length}</td><td>${totalBreastMin} min</td></tr>` : ''}
  ${bottleFeeds.length > 0 ? `<tr><td>Bottle (formula/pumped)</td><td>${bottleFeeds.length}</td><td>${fmtVol(totalOz, volumeUnit)}</td></tr>` : ''}
  ${solidFeeds.length > 0 ? `<tr><td>Solids</td><td>${solidFeeds.length}</td><td>—</td></tr>` : ''}
</table>

<h2>💧 Diapers</h2>
<div class="grid">
  <div class="stat"><div class="stat-label">Avg diapers/day</div><div class="stat-value">${avgDiapersPerDay}</div></div>
  <div class="stat"><div class="stat-label">Wet / Dirty</div><div class="stat-value">${wetCount} / ${dirtyCount}</div></div>
</div>

<h2>😴 Sleep</h2>
<div class="grid">
  <div class="stat"><div class="stat-label">Avg sleep/day</div><div class="stat-value">${avgSleepHrs}h</div></div>
  <div class="stat"><div class="stat-label">Naps / Nights</div><div class="stat-value">${naps.length} / ${nights.length}</div></div>
</div>

${latestGrowth ? `<h2>📊 Growth</h2>
<div class="grid">
  ${latestGrowth.amount ? `<div class="stat"><div class="stat-label">Latest (${fmtDate(latestGrowth.date)})</div><div class="stat-value">${latestGrowth.amount}</div></div>` : ''}
  ${prevGrowth && prevGrowth.amount ? `<div class="stat"><div class="stat-label">Previous (${fmtDate(prevGrowth.date)})</div><div class="stat-value">${prevGrowth.amount}</div></div>` : ''}
</div>` : ''}

${highTemps.length > 0 ? `<h2>🌡️ Temperature Flags</h2>
<div class="flag">Elevated temperatures recorded: ${highTemps.length} time(s) in ${days} days
${highTemps.slice(0, 3).map((e) => `<br>· ${fmtDate(e.date)} ${fmtTime(e.time)} — ${e.amount}`).join('')}</div>` : ''}

${medTypes.length > 0 ? `<h2>💊 Medications</h2>
<table><tr><th>Medication</th><th>Doses in period</th></tr>
${medTypes.map((m) => `<tr><td>${m}</td><td>${meds.filter((e) => e.type === m).length}</td></tr>`).join('')}
</table>` : ''}

${allergies.length > 0 ? `<h2>⚠️ Food Introduction / Allergies</h2>
<div class="${reactions.length > 0 ? 'flag' : 'flag good'}">
${allergies.length} foods introduced${reactions.length > 0 ? ` · ${reactions.length} reaction(s) noted` : ' · No reactions noted'}
</div>` : ''}

<h2>💉 Immunizations</h2>
${completedVaccines.length > 0 ? `<div class="flag good">Completed: ${completedVaccines.join(', ')}</div>` : ''}
${pendingVaccines.length > 0 ? `<div class="flag">Pending: ${pendingVaccines.join(', ')}</div>` : '<div class="flag good">All age-appropriate vaccines up to date!</div>'}

<div class="footer">
  Generated by BabyBloom · Data stored locally on parent's device · Not medical advice<br>
  Discuss all findings with your healthcare provider
</div>
</body></html>`;

    setReportHtml(html);
    setGenerating(false);
    toast('Report ready — tap Share to save as PDF');
  }, [period, logs, babyName, birth, age, vDone, volumeUnit]);

  const handleShare = useCallback(() => {
    if (!reportHtml) return;
    const blob = new Blob([reportHtml], { type: 'text/html' });
    const file = new File([blob], `${babyName}-report.html`, { type: 'text/html' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: `${babyName} Care Report` }).catch(() => {});
    } else {
      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${babyName}-report.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Report downloaded');
    }
  }, [reportHtml, babyName]);

  const handleBack = useCallback(() => {
    setReportHtml(null);
  }, []);

  const handleClose = useCallback(() => {
    setReportHtml(null);
    onClose();
  }, [onClose]);

  // ─── Full-screen report preview ───
  if (reportHtml) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 210,
          background: C.bg,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', borderBottom: '1px solid ' + C.b,
        }}>
          <button onClick={handleBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', gap: 4, color: C.s, fontSize: 14, fontWeight: 600 }}>
            <Ic n="arrow-left" s={18} c={C.s} /> Back
          </button>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>Report Preview</div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Ic n="x" s={22} c={C.tl} />
          </button>
        </div>
        <iframe
          ref={iframeRef}
          srcDoc={reportHtml}
          style={{ flex: 1, border: 'none', width: '100%' }}
          title="Report Preview"
        />
        <div style={{ padding: '12px 16px 28px', borderTop: '1px solid ' + C.b }}>
          <Btn label="Share / Save Report" onClick={handleShare} color={C.s} full />
        </div>
      </div>
    );
  }

  // ─── Config bottom sheet ───
  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 500,
          margin: '0 auto',
          background: C.bg,
          borderRadius: '20px 20px 0 0',
          padding: '20px 16px 40px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.t, margin: 0 }}>
              Pediatrician Report
            </h3>
            <div style={{ fontSize: 12, color: C.tl }}>
              Summarize {babyName}'s care for your doctor
            </div>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Ic n="x" s={22} c={C.tl} />
          </button>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: C.t, marginBottom: 8 }}>
          Report period
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([
            { key: '7' as ReportPeriod, label: 'Last 7 days' },
            { key: '14' as ReportPeriod, label: 'Last 2 weeks' },
            { key: '30' as ReportPeriod, label: 'Last month' },
          ]).map((opt) => (
            <div
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: 12,
                background: period === opt.key ? C.sl : C.cd,
                border: '1px solid ' + (period === opt.key ? C.s : C.b),
                cursor: 'pointer',
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 600,
                color: period === opt.key ? C.s : C.t,
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: C.tl, marginBottom: 16, lineHeight: 1.5 }}>
          Includes feeding patterns, diaper counts, sleep, growth,
          temperature flags, medications, food introductions, and vaccines.
        </div>

        <Btn
          label={generating ? 'Generating...' : 'Generate Report'}
          onClick={generateReport}
          color={C.s}
          full
        />
      </div>
    </div>
  );
}
