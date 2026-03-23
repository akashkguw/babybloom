/**
 * TypeScript interfaces for all data stored in the app
 * Defines the structure of logs, profile, and other persistent data
 */

// ═══ LOG ENTRIES ═══

export interface LogEntry {
  id: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  type?: string;
  notes?: string;
}

export interface FeedEntry extends LogEntry {
  type?: "Breast L" | "Breast R" | "Formula" | "Pumped Milk" | "Bottle";
  oz?: number;
  amount?: string;
  duration?: string;
}

export interface DiaperEntry extends LogEntry {
  type?: "Wet" | "Dirty" | "Both";
  color?: string;
  consistency?: string;
  peeAmount?: string;
}

export interface SleepEntry extends LogEntry {
  type?: "Nap" | "Night Sleep" | "Tummy Time" | "Wake Up";
  amount?: string;
  mins?: number;
  duration?: string;
  sleepHrs?: string;
  sleepMins?: string;
}

export interface GrowthEntry extends LogEntry {
  weight?: number;
  height?: number;
  notes?: string;
}

export interface TempEntry extends LogEntry {
  temp?: number;
}

export interface BathEntry extends LogEntry {
  waterTemp?: number;
  duration?: string;
  notes?: string;
}

export interface MassageEntry extends LogEntry {
  type?: string;
  duration?: string;
  notes?: string;
}

export interface MedsEntry extends LogEntry {
  med?: string;
  dose?: string;
  reason?: string;
}

export interface AllergyEntry extends LogEntry {
  food?: string;
  reaction?: string;
  severity?: "mild" | "moderate" | "severe";
}

// ═══ LOG COLLECTION ═══

export interface Logs {
  feed?: FeedEntry[];
  pump?: FeedEntry[];
  diaper?: DiaperEntry[];
  sleep?: SleepEntry[];
  bath?: BathEntry[];
  massage?: MassageEntry[];
  growth?: GrowthEntry[];
  temp?: TempEntry[];
  meds?: MedsEntry[];
  allergy?: AllergyEntry[];
}

// ═══ PROFILE ═══

export interface Profile {
  name?: string;
  dob?: string; // YYYY-MM-DD (baby's date of birth)
  gender?: string;
  weight?: number; // at birth, in lbs
  height?: number; // at birth, in inches
  feedingType?: "breast" | "formula" | "combination";
  feedingMethod?: "bottle" | "breast" | "both";
  volumeUnit?: "oz" | "ml"; // user's preferred unit
  temperatureUnit?: "F" | "C"; // user's preferred unit
  theme?: "light" | "dark" | "auto";
  notifications?: boolean;
}

// ═══ TIMER STATE ═══

export interface TimerState {
  running?: boolean;
  type?: string;
  startTime?: number;
}

// ═══ REMINDERS & ALERTS ═══

export interface Reminder {
  id?: string;
  title?: string;
  date?: string;
  time?: string;
  repeat?: "daily" | "weekly" | "monthly" | "once";
  enabled?: boolean;
}

export interface Reminders {
  [key: string]: Reminder[];
}

// ═══ MILESTONES & FIRSTS ═══

export interface FirstEntry {
  id?: number;
  date?: string;
  title?: string;
  notes?: string;
  emoji?: string;
}

// ═══ EMERGENCY CONTACTS ═══

export interface EmergencyContact {
  name?: string;
  relationship?: string;
  phone?: string;
}

// ═══ APP STATE ═══

/**
 * Main data store structure
 * Maps to IndexedDB object store where key is always "data"
 */
export interface AppData {
  logs?: Logs;
  profile?: Profile;
  timerState?: TimerState;
  reminders?: Reminders;
  firsts?: FirstEntry[];
  emergencyContacts?: EmergencyContact[];
  lastSync?: number; // timestamp
}
