import React, { useState } from 'react';
import { C } from '@/lib/constants/colors';
import Pill from '@/components/shared/Pill';
import Card from '@/components/shared/Card';
import StatsSummary from './StatsSummary';
import { today, daysAgo, weekLabel, monthLabel, getWeekStart } from '@/lib/utils/date';
import { fmtVol, volLabel } from '@/lib/utils/volume';

interface StatsViewProps {
  logs: any;
  period: 'daily' | 'weekly' | 'monthly';
  setPeriod: (period: 'daily' | 'weekly' | 'monthly') => void;
  logColors: Record<string, string>;
  volumeUnit: 'ml' | 'oz';
}

/** Generate date keys for the selected period */
function getPeriodBuckets(period: 'daily' | 'weekly' | 'monthly'): { key: string; label: string }[] {
  const buckets: { key: string; label: string }[] = [];

  if (period === 'daily') {
    // Last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(i);
      buckets.push({ key: d, label: weekLabel(d) });
    }
  } else if (period === 'weekly') {
    // Last 4 weeks (each bucket = week start date)
    const seen = new Set<string>();
    for (let i = 27; i >= 0; i--) {
      const d = daysAgo(i);
      const ws = getWeekStart(d);
      if (!seen.has(ws)) {
        seen.add(ws);
        buckets.push({ key: ws, label: weekLabel(ws) });
      }
    }
  } else {
    // Last 6 months
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key =
        m.getFullYear() +
        '-' +
        String(m.getMonth() + 1).padStart(2, '0');
      buckets.push({ key, label: monthLabel(key + '-01') });
    }
  }

  return buckets;
}

/** Count entries per bucket */
function countByBucket(
  entries: any[],
  period: 'daily' | 'weekly' | 'monthly',
  buckets: { key: string; label: string }[]
): number[] {
  const counts = buckets.map(() => 0);

  (entries || []).forEach((e: any) => {
    if (!e.date) return;
    let bucketKey: string;

    if (period === 'daily') {
      bucketKey = e.date;
    } else if (period === 'weekly') {
      bucketKey = getWeekStart(e.date);
    } else {
      bucketKey = e.date.slice(0, 7); // YYYY-MM
    }

    const idx = buckets.findIndex((b) => b.key === bucketKey);
    if (idx >= 0) counts[idx]++;
  });

  return counts;
}

/** Sum a numeric field per bucket */
function sumByBucket(
  entries: any[],
  field: string,
  period: 'daily' | 'weekly' | 'monthly',
  buckets: { key: string; label: string }[]
): number[] {
  const sums = buckets.map(() => 0);

  (entries || []).forEach((e: any) => {
    if (!e.date) return;
    const val = typeof e[field] === 'number' ? e[field] : parseFloat(e[field]);
    if (!val || isNaN(val)) return;

    let bucketKey: string;

    if (period === 'daily') {
      bucketKey = e.date;
    } else if (period === 'weekly') {
      bucketKey = getWeekStart(e.date);
    } else {
      bucketKey = e.date.slice(0, 7);
    }

    const idx = buckets.findIndex((b) => b.key === bucketKey);
    if (idx >= 0) sums[idx] += val;
  });

  return sums;
}

/** Format bar label based on metric */
function fmtBarVal(val: number, metric: string, volumeUnit: 'ml' | 'oz'): string {
  if (val === 0) return '';
  if (metric === 'volume') return fmtVol(val, volumeUnit);
  if (metric === 'hours') {
    const h = Math.floor(val / 60);
    const m = Math.round(val % 60);
    return h > 0 ? h + 'h' + (m > 0 ? m + 'm' : '') : m + 'm';
  }
  if (metric === 'minutes') {
    const h = Math.floor(val / 60);
    const m = Math.round(val % 60);
    return h > 0 ? h + 'h' + (m > 0 ? m + 'm' : '') : m + 'm';
  }
  return String(Math.round(val * 10) / 10);
}

/** Pure CSS bar chart */
function BarChart({
  data,
  labels,
  color,
  metric,
  volumeUnit,
}: {
  data: number[];
  labels: string[];
  color: string;
  metric?: string;
  volumeUnit?: 'ml' | 'oz';
}) {
  const maxVal = Math.max(...data, 1);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 4,
        height: 100,
        padding: '8px 0',
      }}
    >
      {data.map((val, i) => {
        const pct = Math.max((val / maxVal) * 100, val > 0 ? 4 : 0);
        const displayVal = metric && volumeUnit ? fmtBarVal(val, metric, volumeUnit) : (val > 0 ? String(Math.round(val * 10) / 10) : '');
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
              justifyContent: 'flex-end',
            }}
          >
            {val > 0 && (
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: C.t,
                  marginBottom: 2,
                }}
              >
                {displayVal}
              </div>
            )}
            <div
              style={{
                width: '100%',
                maxWidth: 32,
                height: pct + '%',
                background: val > 0 ? color : C.b,
                borderRadius: 4,
                minHeight: val > 0 ? 4 : 2,
                opacity: val > 0 ? 1 : 0.3,
                transition: 'height 0.3s ease',
              }}
            />
            <div
              style={{
                fontSize: 9,
                color: C.tl,
                marginTop: 4,
                whiteSpace: 'nowrap',
              }}
            >
              {labels[i]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Metric selector pill row */
function MetricPills({
  options,
  active,
  onSelect,
  color,
}: {
  options: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
  color: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
      {options.map((opt) => {
        const isActive = active === opt.id;
        return (
          <div
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            style={{
              padding: '3px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: isActive ? color : 'transparent',
              color: isActive ? 'white' : C.tl,
              border: '1px solid ' + (isActive ? 'transparent' : C.b),
            }}
          >
            {opt.label}
          </div>
        );
      })}
    </div>
  );
}

export default function StatsView({
  logs,
  period,
  setPeriod,
  logColors,
  volumeUnit,
}: StatsViewProps) {
  const [feedMetric, setFeedMetric] = useState('count');
  const [sleepMetric, setSleepMetric] = useState('count');
  const [diaperMetric, setDiaperMetric] = useState('count');

  const buckets = getPeriodBuckets(period);
  const labels = buckets.map((b) => b.label);

  const feedEntries = logs.feed || [];
  const sleepEntries = (logs.sleep || []).filter(
    (e: any) => e.type !== 'Wake Up'
  );
  const diaperEntries = logs.diaper || [];

  // Feed data based on selected metric
  function getFeedData(): number[] {
    if (feedMetric === 'volume') return sumByBucket(feedEntries, 'oz', period, buckets);
    if (feedMetric === 'minutes') return sumByBucket(feedEntries, 'mins', period, buckets);
    return countByBucket(feedEntries, period, buckets);
  }

  // Sleep data based on selected metric
  // For duration (hours), use Wake Up entries which carry the mins field
  const sleepWakeEntries = (logs.sleep || []).filter(
    (e: any) => e.type === 'Wake Up' && e.mins
  );
  function getSleepData(): number[] {
    if (sleepMetric === 'hours') return sumByBucket(sleepWakeEntries, 'mins', period, buckets);
    return countByBucket(sleepEntries, period, buckets);
  }

  // Diaper data based on selected metric
  function getDiaperData(): number[] {
    if (diaperMetric === 'wet') {
      const wetEntries = diaperEntries.filter((e: any) => e.type === 'Wet' || e.type === 'Mixed');
      return countByBucket(wetEntries, period, buckets);
    }
    if (diaperMetric === 'dirty') {
      const dirtyEntries = diaperEntries.filter((e: any) => e.type === 'Dirty' || e.type === 'Mixed');
      return countByBucket(dirtyEntries, period, buckets);
    }
    return countByBucket(diaperEntries, period, buckets);
  }

  const hasAnyData = !Object.keys(logs).every(
    (k) => (logs[k] || []).length === 0
  );

  const periodLabel = period === 'daily' ? 'Last 7 days' : period === 'weekly' ? 'Last 4 weeks' : 'Last 6 months';

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['daily', 'weekly', 'monthly'].map((p) => (
          <Pill
            key={p}
            label={p.charAt(0).toUpperCase() + p.slice(1)}
            active={period === p}
            onClick={() => setPeriod(p as 'daily' | 'weekly' | 'monthly')}
            color={C.s}
          />
        ))}
      </div>

      <Card style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>
            🍼 Feeding
          </div>
          <div style={{ fontSize: 12, color: C.tl }}>
            {periodLabel}
          </div>
        </div>
        <MetricPills
          options={[
            { id: 'count', label: 'Count' },
            { id: 'volume', label: volLabel(volumeUnit) },
            { id: 'minutes', label: 'Minutes' },
          ]}
          active={feedMetric}
          onSelect={setFeedMetric}
          color={logColors.feed || C.p}
        />
        <BarChart data={getFeedData()} labels={labels} color={logColors.feed || C.p} metric={feedMetric} volumeUnit={volumeUnit} />
        <StatsSummary entries={feedEntries} label="Feedings" />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>
            😴 Sleep
          </div>
          <div style={{ fontSize: 12, color: C.tl }}>
            {periodLabel}
          </div>
        </div>
        <MetricPills
          options={[
            { id: 'count', label: 'Count' },
            { id: 'hours', label: 'Duration' },
          ]}
          active={sleepMetric}
          onSelect={setSleepMetric}
          color={logColors.sleep || C.pu}
        />
        <BarChart data={getSleepData()} labels={labels} color={logColors.sleep || C.pu} metric={sleepMetric} volumeUnit={volumeUnit} />
        <StatsSummary entries={sleepEntries} label="Sleep" />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>
            💧 Diapers
          </div>
          <div style={{ fontSize: 12, color: C.tl }}>
            {periodLabel}
          </div>
        </div>
        <MetricPills
          options={[
            { id: 'count', label: 'Count' },
            { id: 'wet', label: 'Wet' },
            { id: 'dirty', label: 'Dirty' },
          ]}
          active={diaperMetric}
          onSelect={setDiaperMetric}
          color={logColors.diaper || C.a}
        />
        <BarChart data={getDiaperData()} labels={labels} color={logColors.diaper || C.a} metric={diaperMetric} volumeUnit={volumeUnit} />
        <StatsSummary entries={diaperEntries} label="Diapers" />
      </Card>

      {!hasAnyData && (
        <Card style={{ textAlign: 'center', padding: 30, color: C.tl }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <div>Start logging to see your stats!</div>
        </Card>
      )}
    </>
  );
}
