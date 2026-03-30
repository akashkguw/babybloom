/**
 * Input validation utilities for BabyBloom
 * Prevents invalid health data from being saved
 */

/** Clamp a numeric string to [min, max], returning '' if invalid */
export function clampNum(v: string, min: number, max: number, decimals = 1): string {
  if (v === '' || v === '-') return '';
  const n = parseFloat(v);
  if (isNaN(n)) return '';
  if (n < min) return String(min);
  if (n > max) return String(Math.round(max * 10 ** decimals) / 10 ** decimals);
  // Preserve user input formatting unless it exceeds decimal places
  const parts = v.split('.');
  if (parts[1] && parts[1].length > decimals) {
    return n.toFixed(decimals);
  }
  return v;
}

/** Parse a numeric string safely, returning fallback if invalid or out of range */
export function safeNum(v: string | undefined, min: number, max: number, fallback = 0): number {
  if (!v) return fallback;
  const n = parseFloat(v);
  if (isNaN(n) || n < min || n > max) return fallback;
  return n;
}

/** Validate that a date string is not in the future and not unreasonably old */
export function isValidBirthDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) return false;
  // No baby older than 5 years for this app (0-24 months focus)
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  if (d < fiveYearsAgo) return false;
  return true;
}

/** Validate phone number: at least 7 digits after stripping formatting */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/** Trim and limit string length */
export function cleanStr(v: string, maxLen = 200): string {
  return v.trim().slice(0, maxLen);
}

/** Validate a family sync code (bloom-xxxxxxxx format, 8+ alphanumeric suffix) */
export function isValidFamilyCode(code: string): boolean {
  return /^bloom-[a-z0-9]{8,}$/.test(code.trim().toLowerCase());
}

/** Reasonable ranges for baby health data */
export const LIMITS = {
  feedMins: { min: 0, max: 120 },        // 0–120 min feeding
  feedOz: { min: 0, max: 20 },           // 0–20 oz per feed
  feedMl: { min: 0, max: 600 },          // 0–600 ml per feed
  sleepHrs: { min: 0, max: 24 },         // 0–24 hours
  sleepMins: { min: 0, max: 59 },        // 0–59 minutes
  tummyMins: { min: 0, max: 120 },       // 0–120 min tummy time
  pumpOz: { min: 0, max: 20 },           // 0–20 oz per pump
  pumpMl: { min: 0, max: 600 },          // 0–600 ml per pump
  pumpMins: { min: 0, max: 120 },        // 0–120 min pump duration
  weightLbs: { min: 1, max: 60 },        // 1–60 lbs
  weightKg: { min: 0.5, max: 27 },       // 0.5–27 kg
  heightIn: { min: 10, max: 45 },        // 10–45 inches
  heightCm: { min: 25, max: 115 },       // 25–115 cm
  headIn: { min: 8, max: 22 },           // 8–22 inches
  headCm: { min: 20, max: 56 },          // 20–56 cm
  tempF: { min: 90, max: 110 },          // 90–110 °F
  tempC: { min: 32, max: 43 },           // 32–43 °C
  medDose: { min: 0, max: 100 },         // 0–100 mL dose
  massageMins: { min: 0, max: 120 },     // 0–120 min massage
  nameLen: 50,                            // max characters for names
  noteLen: 500,                           // max characters for notes
} as const;
