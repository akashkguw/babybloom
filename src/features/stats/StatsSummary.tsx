import React from 'react';
import { C } from '@/lib/constants/colors';
import { today } from '@/lib/utils/date';

interface StatsSummaryProps {
  entries: any[];
  label: string;
}

function daysAgo(d: number): string {
  const a = new Date();
  a.setDate(a.getDate() - d);
  return a.getFullYear() + '-' + String(a.getMonth() + 1).padStart(2, '0') + '-' + String(a.getDate()).padStart(2, '0');
}

export default function StatsSummary({ entries, label }: StatsSummaryProps) {
  const td = today();
  const todayC = (entries || []).filter((e) => e.date === td).length;
  let weekC = 0;
  for (let i = 0; i < 7; i++) {
    const dk = daysAgo(i);
    weekC += (entries || []).filter((e) => e.date === dk).length;
  }
  const avg = Math.round((weekC / 7) * 10) / 10;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
      <div style={{ textAlign: 'center', padding: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.t }}>{todayC}</div>
        <div style={{ fontSize: 10, color: C.tl }}>Today</div>
      </div>
      <div style={{ textAlign: 'center', padding: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.t }}>{weekC}</div>
        <div style={{ fontSize: 10, color: C.tl }}>This Week</div>
      </div>
      <div style={{ textAlign: 'center', padding: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.t }}>{avg}</div>
        <div style={{ fontSize: 10, color: C.tl }}>Daily Avg</div>
      </div>
    </div>
  );
}
