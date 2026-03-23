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
