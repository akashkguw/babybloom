/**
 * Date and time formatting utilities
 */

/**
 * Get today's date as YYYY-MM-DD
 */
export function today(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

/**
 * Get current time as HH:MM (24-hour format)
 */
export function now(): string {
  const d = new Date();
  return (
    d.getHours().toString().padStart(2, "0") +
    ":" +
    d.getMinutes().toString().padStart(2, "0")
  );
}

/**
 * Format time string HH:MM to 12-hour format with AM/PM
 * @param t Time string like "14:30"
 * @returns Formatted time like "2:30 PM"
 */
export function fmtTime(t: string | undefined): string {
  if (!t) return "";

  const parts = t.split(":");
  let h = parseInt(parts[0]);
  const m = parts[1];
  const ap = h >= 12 ? "PM" : "AM";

  h = h % 12 || 12;

  return h + ":" + m + " " + ap;
}

/**
 * Format date string YYYY-MM-DD to "MMM D" format
 * @param d Date string like "2024-03-23"
 * @returns Formatted date like "Mar 23"
 */
export function fmtDate(d: string | undefined): string {
  if (!d) return "";

  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Get a date n days ago as YYYY-MM-DD
 */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

/**
 * Format date for week label (M/D)
 */
export function weekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.getMonth() + 1 + "/" + d.getDate();
}

/**
 * Format date for month label (Jan, Feb, etc.)
 */
export function monthLabel(dateStr: string): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return months[parseInt(dateStr.slice(5, 7)) - 1];
}

/**
 * Get the start of the week (Monday) for a given date
 * @param dateStr Date string like "2024-03-23"
 * @returns Week start date as YYYY-MM-DD
 */
/**
 * Auto-detect sleep type based on time of day and optional existing entries.
 *
 * Overload 1 — time-only (legacy): returns 'Nap' or 'Night Sleep' based on
 * the hour of the provided time string (or the current time if omitted).
 *
 * Overload 2 — entries-aware: when a SleepEntry[] is passed as the first
 * argument, returns 'Wake Up' if there is an unmatched sleep-start in that
 * list; otherwise falls back to time-based detection ('Nap' or 'Night Sleep').
 *
 * Night Sleep: 7:00 PM (19:00) to 6:59 AM (06:59)
 * Nap: 7:00 AM (07:00) to 6:59 PM (18:59)
 */
export function autoSleepType(time?: string): "Nap" | "Night Sleep";
export function autoSleepType(entries: SleepEntry[], time?: string): "Nap" | "Night Sleep" | "Wake Up";
export function autoSleepType(
  entriesOrTime?: SleepEntry[] | string,
  time?: string
): "Nap" | "Night Sleep" | "Wake Up" {
  let effectiveTime: string | undefined;

  if (Array.isArray(entriesOrTime)) {
    // Entries-aware path: suggest Wake Up when an open sleep-start exists.
    if (findUnmatchedSleep(entriesOrTime)) return "Wake Up";
    effectiveTime = time;
  } else {
    effectiveTime = entriesOrTime;
  }

  const hour = effectiveTime
    ? parseInt(effectiveTime.split(":")[0])
    : new Date().getHours();
  return hour >= 19 || hour < 7 ? "Night Sleep" : "Nap";
}

/**
 * Minimal shape needed for sleep-entry matching.
 * Both HomeTab and LogTab use their own local LogEntry interfaces;
 * this keeps date.ts free of cross-module dependencies.
 */
export interface SleepEntry {
  id: number;
  type: string;
  date?: string;
  time?: string;
}

/**
 * Find the most-recent sleep-start (Nap / Night Sleep) that has NOT yet
 * been followed by a Wake Up entry.
 *
 * Algorithm: scan ALL entries and track the one with the highest numeric id.
 * - If the highest-id entry is a Nap or Night Sleep → it is unmatched → return it.
 * - If the highest-id entry is a Wake Up → the last sleep is already closed → return null.
 * - If no relevant entries exist → return null.
 *
 * This prevents double-counting when two Wake Up entries are logged against
 * the same sleep-start (the root cause of the corrupted duration math).
 */
export function findUnmatchedSleep(entries: SleepEntry[]): SleepEntry | null {
  let latest: SleepEntry | null = null;
  for (const e of entries) {
    if (e.type !== 'Nap' && e.type !== 'Night Sleep' && e.type !== 'Wake Up') continue;
    if (!latest || e.id > latest.id) latest = e;
  }
  if (!latest) return null;
  return latest.type === 'Nap' || latest.type === 'Night Sleep' ? latest : null;
}

/**
 * Calculate sleep duration in minutes using both date and time.
 * Returns 0 if duration is non-positive or exceeds 24 hours.
 */
export function calcSleepMins(
  sleepDate: string,
  sleepTime: string,
  wakeDate: string,
  wakeTime: string
): number {
  const [sy, sm, sd] = sleepDate.split("-").map(Number);
  const [sh, smin] = sleepTime.split(":").map(Number);
  const [wy, wm, wd] = wakeDate.split("-").map(Number);
  const [wh, wmin] = wakeTime.split(":").map(Number);

  const sleepMs = new Date(sy, sm - 1, sd, sh, smin).getTime();
  const wakeMs = new Date(wy, wm - 1, wd, wh, wmin).getTime();

  const diffMins = Math.round((wakeMs - sleepMs) / 60000);

  if (diffMins > 0 && diffMins < 1440) return diffMins;
  return 0;
}

export function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const m = new Date(d.getFullYear(), d.getMonth(), diff);

  return (
    m.getFullYear() +
    "-" +
    String(m.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(m.getDate()).padStart(2, "0")
  );
}
