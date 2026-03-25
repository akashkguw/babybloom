/**
 * Country Configuration System
 *
 * Architecture designed for easy addition of new countries.
 * Each country provides its own medical guidelines, emergency numbers,
 * vaccine schedules, medicine names, and cultural adaptations.
 *
 * To add a new country:
 * 1. Create a new file (e.g., uk.ts) implementing CountryConfig
 * 2. Register it in index.ts
 * 3. That's it — the app automatically picks up the new country
 */

import type { VolumeUnit, TemperatureUnit } from '../../utils/types';

// ═══ VACCINE SCHEDULE ═══
export interface CountryVaccine {
  n: string;   // vaccine name
  d: string;   // dose description
}

export interface CountryVaccineSchedule {
  age: string;
  v: CountryVaccine[];
}

// ═══ MEDICINE DOSING ═══
export interface MedicineDosing {
  /** Display name, e.g. "Infant Acetaminophen (Tylenol)" or "Paracetamol (Calpol/Crocin)" */
  name: string;
  /** Generic drug name for reference */
  genericName: string;
  /** Concentration in mg per 5ml, e.g. 160 (US) or 120 (India) */
  concentrationMg: number;
  /** Concentration display string, e.g. "160 mg / 5 mL" */
  concentrationLabel: string;
  /** Low dose multiplier (mg per kg), e.g. 10 */
  doseLowPerKg: number;
  /** High dose multiplier (mg per kg), e.g. 15 */
  doseHighPerKg: number;
  /** Dosing frequency instruction */
  frequency: string;
  /** Max doses per day */
  maxDoses: string;
  /** Emoji for display */
  emoji: string;
  /** Minimum age restriction (in months), null if from birth */
  minAgeMonths: number | null;
  /** Age restriction display text */
  ageRestriction?: string;
}

// ═══ FEVER GUIDE ═══
export interface CountryFeverEntry {
  age: string;
  temp: string;
  action: string;
  urgent: boolean;
  detail: string;
}

// ═══ CPR / CHOKING ═══
export interface CountryEmergencyStep {
  step: number;
  title: string;
  detail: string;
}

// ═══ SAFETY ═══
export interface CountrySafetySection {
  t: string;
  icon: string;
  c: string;
  items: string[];
}

// ═══ VISITS ═══
export interface CountryVisit {
  a: string;
  f: string;
}

// ═══ FORMULA GUIDE ═══
export interface CountryFormulaNote {
  r: string;
  d: string;
}

// ═══ MAIN COUNTRY CONFIG ═══
export interface CountryConfig {
  /** Country code, e.g. "US", "IN" */
  code: string;
  /** Display name, e.g. "United States", "India" */
  name: string;
  /** Flag emoji */
  flag: string;
  /** Default locale for this country */
  defaultLocale: string;
  /** Supported locales for this country */
  locales: string[];

  // ─── Units & Formatting ───
  defaults: {
    volumeUnit: VolumeUnit;
    temperatureUnit: TemperatureUnit;
    dateFormat: string;
    /** Weight input: "lbs" or "kg" */
    weightUnit: 'lbs' | 'kg';
    /** Weight conversion factor (to kg): lbs=2.205, kg=1 */
    weightToKgDivisor: number;
    /** Weight input placeholder */
    weightPlaceholder: string;
    /** Weight limits for validation */
    weightLimits: { min: number; max: number };
  };

  // ─── Emergency ───
  emergency: {
    /** Primary emergency number (911, 112) */
    primaryNumber: string;
    /** Poison control number */
    poisonControl: string;
    /** Pediatric/medical helpline */
    pediatricHotline: string;
    /** Default emergency contacts initialized in app */
    defaultContacts: Array<{
      id: number;
      name: string;
      phone: string;
      role: string;
    }>;
    /** Emergency banner display text */
    bannerTitle: string;
    bannerSubtitle: string;
  };

  // ─── Medical References ───
  medical: {
    /** Primary pediatric authority, e.g. "AAP", "IAP" */
    authority: string;
    /** Full authority name */
    authorityFull: string;
    /** Regulatory body for formula, e.g. "FDA", "FSSAI" */
    formulaRegulator: string;
    /** CPR training organization */
    cprOrganization: string;
    /** Full CPR org name */
    cprOrganizationFull: string;
    /** Temperature thresholds display */
    normalTempRange: string;
    /** Room temp for sleep */
    sleepRoomTemp: string;
    /** Massage room temp */
    massageRoomTemp: string;
  };

  // ─── Vaccines ───
  vaccines: CountryVaccineSchedule[];
  /** Source attribution for vaccine schedule */
  vaccineSource: string;

  // ─── Medicine Dosing ───
  medicines: {
    antipyretic: MedicineDosing;     // fever reducer 1 (acetaminophen/paracetamol)
    antiInflammatory: MedicineDosing; // fever reducer 2 (ibuprofen)
    /** Quick reference tips */
    tips: string[];
  };

  // ─── Fever Guide ───
  feverGuide: CountryFeverEntry[];

  // ─── CPR Steps ───
  cprSteps: CountryEmergencyStep[];
  cprDisclaimer: string;

  // ─── Choking Steps ───
  chokingSteps: CountryEmergencyStep[];

  // ─── Safety ───
  safety: CountrySafetySection[];

  // ─── Well-child Visits ───
  visits: CountryVisit[];

  // ─── Formula Guide Overrides ───
  formulaNotes: CountryFormulaNote[];

  // ─── Remedy brand names ───
  remedyBrands: {
    /** Gas drops brand, e.g. "Mylicon" or "Colicaid" */
    gasDrops: string;
    /** Diaper cream brand, e.g. "Aquaphor/Desitin" or "Himalaya/Sebamed" */
    diaperCream: string;
    /** Fever reducer reference in remedies */
    feverReducer: string;
  };
}

/** Supported country codes */
export type CountryCode = 'US' | 'IN';
