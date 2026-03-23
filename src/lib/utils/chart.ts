/**
 * Chart aggregation utilities for data visualization
 * Aggregates log entries into daily/weekly/monthly buckets
 */

import {
  daysAgo,
  getWeekStart,
  monthLabel,
  weekLabel,
} from "./date";

export interface ChartPoint {
  label: string;
  value: number;
  key: string;
}

/**
 * Aggregate log entries by count
 * @param entries Array of log entries with date and optional time
 * @param period "daily", "weekly", or "monthly"
 * @returns Array of chart points with counts
 */
export function aggregateLogs(
  entries: Array<{ date?: string; time?: string }>,
  period: "daily" | "weekly" | "monthly"
): ChartPoint[] {
  const buckets: { [key: string]: number } = {};
  const labels: { [key: string]: string } = {};
  const order: string[] = [];

  if (period === "daily") {
    for (let i = 6; i >= 0; i--) {
      const dk = daysAgo(i);
      buckets[dk] = 0;
      labels[dk] = weekLabel(dk);
      order.push(dk);
    }
  } else if (period === "weekly") {
    for (let i = 3; i >= 0; i--) {
      const dk = getWeekStart(daysAgo(i * 7));
      if (!buckets[dk]) {
        buckets[dk] = 0;
        labels[dk] = "W" + (4 - i);
        order.push(dk);
      }
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mk =
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      buckets[mk] = 0;
      labels[mk] = monthLabel(mk);
      order.push(mk);
    }
  }

  (entries || []).forEach((e) => {
    if (!e.date) return;
    const k =
      period === "daily"
        ? e.date
        : period === "weekly"
          ? getWeekStart(e.date)
          : e.date.slice(0, 7);

    if (buckets[k] !== undefined) buckets[k]++;
  });

  return order.map((k) => ({
    label: labels[k],
    value: buckets[k],
    key: k,
  }));
}

/**
 * Aggregate numeric values by averaging them
 * @param entries Array of log entries with date and numeric field
 * @param field The field name to aggregate (e.g., "weight", "temp")
 * @param period "daily", "weekly", or "monthly"
 * @returns Array of chart points with averaged values
 */
export function aggregateValues(
  entries: Array<{ date?: string; [key: string]: any }>,
  field: string,
  period: "daily" | "weekly" | "monthly"
): ChartPoint[] {
  const buckets: { [key: string]: number[] } = {};
  const labels: { [key: string]: string } = {};
  const order: string[] = [];

  if (period === "daily") {
    for (let i = 6; i >= 0; i--) {
      const dk = daysAgo(i);
      buckets[dk] = [];
      labels[dk] = weekLabel(dk);
      order.push(dk);
    }
  } else if (period === "weekly") {
    for (let i = 3; i >= 0; i--) {
      const dk = getWeekStart(daysAgo(i * 7));
      if (!buckets[dk]) {
        buckets[dk] = [];
        labels[dk] = "W" + (4 - i);
        order.push(dk);
      }
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mk =
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      buckets[mk] = [];
      labels[mk] = monthLabel(mk);
      order.push(mk);
    }
  }

  (entries || []).forEach((e) => {
    if (!e.date || !e[field]) return;
    const v = parseFloat(e[field]);
    if (isNaN(v)) return;

    const k =
      period === "daily"
        ? e.date
        : period === "weekly"
          ? getWeekStart(e.date)
          : e.date.slice(0, 7);

    if (buckets[k] !== undefined) buckets[k].push(v);
  });

  return order.map((k) => {
    const arr = buckets[k];
    const avg = arr.length
      ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10
      : 0;

    return {
      label: labels[k],
      value: avg,
      key: k,
    };
  });
}

/**
 * Aggregate numeric values by summing them
 * @param entries Array of log entries with date and numeric field
 * @param field The field name to sum (e.g., "oz")
 * @param period "daily", "weekly", or "monthly"
 * @param divisor Optional divisor (e.g., 1440 to convert minutes to hours)
 * @returns Array of chart points with summed values
 */
export function aggregateSum(
  entries: Array<{ date?: string; [key: string]: any }>,
  field: string,
  period: "daily" | "weekly" | "monthly",
  divisor?: number
): ChartPoint[] {
  const buckets: { [key: string]: number } = {};
  const labels: { [key: string]: string } = {};
  const order: string[] = [];

  if (period === "daily") {
    for (let i = 6; i >= 0; i--) {
      const dk = daysAgo(i);
      buckets[dk] = 0;
      labels[dk] = weekLabel(dk);
      order.push(dk);
    }
  } else if (period === "weekly") {
    for (let i = 3; i >= 0; i--) {
      const dk = getWeekStart(daysAgo(i * 7));
      if (!buckets[dk]) {
        buckets[dk] = 0;
        labels[dk] = "W" + (4 - i);
        order.push(dk);
      }
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mk =
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      buckets[mk] = 0;
      labels[mk] = monthLabel(mk);
      order.push(mk);
    }
  }

  const div = divisor || 1;

  (entries || []).forEach((e) => {
    if (!e.date) return;
    const v = parseFloat(e[field]);
    if (isNaN(v)) return;

    const k =
      period === "daily"
        ? e.date
        : period === "weekly"
          ? getWeekStart(e.date)
          : e.date.slice(0, 7);

    if (buckets[k] !== undefined) buckets[k] += v;
  });

  return order.map((k) => ({
    label: labels[k],
    value: Math.round((buckets[k] / div) * 10) / 10,
    key: k,
  }));
}
