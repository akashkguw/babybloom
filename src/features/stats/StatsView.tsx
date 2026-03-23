import React, { useState } from 'react';
import { C } from '@/lib/constants/colors';
import Pill from '@/components/shared/Pill';
import Card from '@/components/shared/Card';
import StatsSummary from './StatsSummary';
import { today, daysAgo, weekLabel, monthLabel, getWeekStart } from '@/lib/utils/date';

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

/** Pure CSS bar chart */
function BarChart({
  data,
  labels,
  color,
}: {
  data: number[];
  labels: string[];
  color: string;
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
                {val}
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

export default function StatsView({
  logs,
  period,
  setPeriod,
  logColors,
  volumeUnit,
}: StatsViewProps) {
  const buckets = getPeriodBuckets(period);
  const labels = buckets.map((b) => b.label);

  const feedData = countByBucket(logs.feed || [], period, buckets);
  const sleepEntries = (logs.sleep || []).filter(
    (e: any) => e.type !== 'Wake Up' && e.type !== 'Tummy Time'
  );
  const sleepData = countByBucket(sleepEntries, period, buckets);
  const diaperData = countByBucket(logs.diaper || [], period, buckets);

  const hasAnyData = !Object.keys(logs).every(
    (k) => (logs[k] || []).length === 0
  );

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
            {period === 'daily' ? 'Last 7 days' : period === 'weekly' ? 'Last 4 weeks' : 'Last 6 months'}
          </div>
        </div>
        <BarChart data={feedData} labels={labels} color={logColors.feed || C.p} />
        <StatsSummary entries={logs.feed || []} label="Feedings" />
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
            {period === 'daily' ? 'Last 7 days' : period === 'weekly' ? 'Last 4 weeks' : 'Last 6 months'}
          </div>
        </div>
        <BarChart data={sleepData} labels={labels} color={logColors.sleep || C.pu} />
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
            {period === 'daily' ? 'Last 7 days' : period === 'weekly' ? 'Last 4 weeks' : 'Last 6 months'}
          </div>
        </div>
        <BarChart data={diaperData} labels={labels} color={logColors.diaper || C.a} />
        <StatsSummary entries={logs.diaper || []} label="Diapers" />
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
