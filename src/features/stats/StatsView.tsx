import React, { useState } from 'react';
import { C } from '@/lib/constants/colors';
import Pill from '@/components/shared/Pill';
import Card from '@/components/shared/Card';
import StatsSummary from './StatsSummary';
import { mlToOz, ozToMl, fmtVol, volLabel } from '@/lib/utils/volume';

interface StatsViewProps {
  logs: any;
  period: 'daily' | 'weekly' | 'monthly';
  setPeriod: (period: 'daily' | 'weekly' | 'monthly') => void;
  logColors: Record<string, string>;
  volumeUnit: 'ml' | 'oz';
}

export default function StatsView({
  logs,
  period,
  setPeriod,
  logColors,
  volumeUnit,
}: StatsViewProps) {
  const [statMet, setStatMet] = useState<Record<string, string>>({});

  function getMet(cat: string, def: string | null): string | null {
    return statMet[cat] || def;
  }

  function setMet(cat: string, v: string) {
    setStatMet((p) => ({ ...p, [cat]: v }));
  }

  function MetPill(cat: string, id: string, label: string) {
    const isActive = getMet(cat, null) === id;
    return (
      <div
        onClick={() => setMet(cat, id)}
        style={{
          padding: '4px 10px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          background: isActive ? logColors[cat] || C.s : 'transparent',
          color: isActive ? 'white' : C.tl,
          border: '1px solid ' + (isActive ? 'transparent' : C.b),
        }}
      >
        {label}
      </div>
    );
  }

  // Placeholder for chart rendering
  function BarChart({ data, color }: { data: any[]; color: string }) {
    return (
      <div style={{ padding: '12px 0', fontSize: 12, color: C.tl }}>
        Chart would render here with {data.length} data points
      </div>
    );
  }

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>🍼 Feeding</div>
          <div style={{ fontSize: 12, color: C.tl }}>Total</div>
        </div>
        <BarChart data={logs.feed || []} color={logColors.feed || C.s} />
        <StatsSummary entries={logs.feed || []} label="Feedings" />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>😴 Sleep</div>
          <div style={{ fontSize: 12, color: C.tl }}>Total</div>
        </div>
        <BarChart data={logs.sleep || []} color={logColors.sleep || C.s} />
        <StatsSummary entries={logs.sleep || []} label="Sleep" />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>💧 Diapers</div>
          <div style={{ fontSize: 12, color: C.tl }}>Total</div>
        </div>
        <BarChart data={logs.diaper || []} color={logColors.diaper || C.s} />
      </Card>

      {Object.keys(logs).every((k) => (logs[k] || []).length === 0) && (
        <Card style={{ textAlign: 'center', padding: 30, color: C.tl }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <div>Start logging to see your stats!</div>
        </Card>
      )}
    </>
  );
}
