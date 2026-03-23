import React from 'react';
import { C } from '@/lib/constants/colors';

interface GrowthDataPoint {
  m: number; // month
  p5: number;
  p50: number;
  p95: number;
}

interface BabyDataPoint {
  month: number;
  value: number;
}

interface GrowthChartProps {
  data: GrowthDataPoint[];
  babyData: BabyDataPoint[];
  label: string;
  color?: string;
  unit: string;
}

export const GrowthChart: React.FC<GrowthChartProps> = ({
  data,
  babyData,
  label,
  color = C.p,
  unit,
}) => {
  const pad = { t: 20, r: 20, b: 30, l: 40 };
  const w = 300;
  const ht = 200;
  const cw = w - pad.l - pad.r;
  const ch = ht - pad.t - pad.b;

  // Collect all values to determine scale
  const allVals: number[] = [];
  data.forEach((d) => {
    allVals.push(d.p5, d.p50, d.p95);
  });
  babyData.forEach((d) => {
    allVals.push(d.value);
  });

  const minV = Math.floor(Math.min(...allVals)) - 1;
  const maxV = Math.ceil(Math.max(...allVals)) + 1;

  // Scaling functions
  const xScale = (m: number) => pad.l + (m / 24) * cw;
  const yScale = (v: number) => pad.t + ch - ((v - minV) / (maxV - minV)) * ch;

  // Helper to create SVG path
  const line = (pts: [number, number][]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');

  // Generate points for each percentile
  const p5Pts: [number, number][] = data.map((d) => [xScale(d.m), yScale(d.p5)]);
  const p50Pts: [number, number][] = data.map((d) => [xScale(d.m), yScale(d.p50)]);
  const p95Pts: [number, number][] = data.map((d) => [xScale(d.m), yScale(d.p95)]);
  const babyPts: [number, number][] = babyData.map((d) => [
    xScale(d.month),
    yScale(d.value),
  ]);

  // Generate y-axis ticks
  const yTicks: number[] = [];
  for (let v = Math.ceil(minV); v <= Math.floor(maxV); v += Math.ceil((maxV - minV) / 5)) {
    yTicks.push(v);
  }

  return (
    <svg
      width="100%"
      height={ht + 10}
      viewBox={`0 0 ${w} ${ht + 10}`}
      style={{ display: 'block' }}
    >
      {/* Y-axis grid and labels */}
      {yTicks.map((v, i) => (
        <g key={`y${i}`}>
          <line
            x1={pad.l}
            y1={yScale(v)}
            x2={w - pad.r}
            y2={yScale(v)}
            stroke={C.b}
            strokeWidth={0.5}
          />
          <text
            x={pad.l - 4}
            y={yScale(v) + 3}
            textAnchor="end"
            fontSize={9}
            fill={C.tl}
          >
            {v}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {[0, 3, 6, 9, 12, 18, 24].map((m, i) => (
        <text
          key={`x${i}`}
          x={xScale(m)}
          y={ht - 5}
          textAnchor="middle"
          fontSize={9}
          fill={C.tl}
        >
          {m}m
        </text>
      ))}

      {/* Percentile band (p5 to p95) */}
      <path
        d={
          line(p5Pts) +
          line(p95Pts.slice().reverse()).replace('M', 'L') +
          'Z'
        }
        fill={color}
        opacity={0.06}
      />

      {/* Percentile lines */}
      <path
        d={line(p5Pts)}
        fill="none"
        stroke={C.b}
        strokeWidth={1}
        strokeDasharray="4,3"
      />
      <path
        d={line(p95Pts)}
        fill="none"
        stroke={C.b}
        strokeWidth={1}
        strokeDasharray="4,3"
      />
      <path
        d={line(p50Pts)}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        opacity={0.5}
      />

      {/* Percentile labels */}
      <text
        x={w - pad.r + 2}
        y={yScale(data[data.length - 1].p5) + 3}
        fontSize={8}
        fill={C.tl}
      >
        5th
      </text>
      <text
        x={w - pad.r + 2}
        y={yScale(data[data.length - 1].p50) + 3}
        fontSize={8}
        fill={color}
      >
        50th
      </text>
      <text
        x={w - pad.r + 2}
        y={yScale(data[data.length - 1].p95) + 3}
        fontSize={8}
        fill={C.tl}
      >
        95th
      </text>

      {/* Baby's data line */}
      {babyPts.length > 1 && (
        <path
          d={line(babyPts)}
          fill="none"
          stroke={C.p}
          strokeWidth={2.5}
        />
      )}

      {/* Baby's data points */}
      {babyPts.map((p, i) => (
        <circle
          key={`bp${i}`}
          cx={p[0]}
          cy={p[1]}
          r={4}
          fill={C.p}
          stroke={C.cd}
          strokeWidth={2}
        />
      ))}

      {/* Title */}
      <text x={pad.l} y={14} fontSize={11} fontWeight={700} fill={C.t}>
        {label} ({unit})
      </text>
    </svg>
  );
};

export default GrowthChart;
