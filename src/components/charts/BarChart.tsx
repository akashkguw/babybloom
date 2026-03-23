import React from 'react';
import { C } from '@/lib/constants/colors';

interface DataPoint {
  label: string;
  value: number;
  key?: string;
}

interface BarChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  color = C.p,
  height = 140,
}) => {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const chartH = height;
  const w = 300;
  const pad = 10;
  const gap = 4;
  const barW = Math.floor((w - pad * 2) / data.length) - gap;

  return (
    <svg
      width="100%"
      height={chartH + 32}
      viewBox={`0 0 ${w} ${chartH + 32}`}
      style={{ display: 'block' }}
    >
      <line
        x1={pad}
        y1={chartH}
        x2={w - pad}
        y2={chartH}
        stroke={C.b}
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const barH = maxVal > 0 ? (d.value / maxVal) * chartH * 0.85 : 0;
        const x = pad + i * (barW + gap) + gap / 2;
        return (
          <g key={i}>
            <rect
              x={x}
              y={chartH - barH}
              width={barW}
              height={Math.max(barH, 2)}
              rx={4}
              fill={d.value > 0 ? color : C.b}
              opacity={d.value > 0 ? 1 : 0.3}
            />
            {d.value > 0 && (
              <text
                x={x + barW / 2}
                y={chartH - barH - 5}
                textAnchor="middle"
                fontSize={10}
                fill={C.t}
                fontWeight={700}
              >
                {d.value}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={chartH + 14}
              textAnchor="middle"
              fontSize={9}
              fill={C.tl}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default BarChart;
