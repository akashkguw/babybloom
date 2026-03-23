/**
 * Internationalization support for multi-country deployment
 * Includes translations, locale-specific settings, and formatting helpers
 */

import type { Locale, VolumeUnit, TemperatureUnit } from "../utils/types";

// ═══ TRANSLATIONS ═══

export interface Translations {
  [key: string]: string;
}

export interface LocaleTranslations {
  [locale: string]: Translations;
}

export const translations: LocaleTranslations = {
  "en-US": {
    // App title and main navigation
    "app.title": "BabyBloom",
    "nav.home": "Home",
    "nav.log": "Log",
    "nav.milestones": "Milestones",
    "nav.guide": "Guide",
    "nav.safety": "Safety",

    // Emergency numbers
    "emergency.ambulance": "911",
    "emergency.poison_control": "1-800-222-1222",
    "emergency.pediatric_hotline": "1-800-222-1222",

    // Volume units
    "unit.volume.oz": "oz",
    "unit.volume.ml": "ml",

    // Temperature units
    "unit.temp.f": "°F",
    "unit.temp.c": "°C",

    // Common UI
    "btn.save": "Save",
    "btn.cancel": "Cancel",
    "btn.delete": "Delete",
    "btn.edit": "Edit",
    "btn.add": "Add",
    "msg.success": "Success!",
    "msg.error": "Error",
    "msg.loading": "Loading...",
  },

  "en-IN": {
    // App title and main navigation
    "app.title": "BabyBloom",
    "nav.home": "Home",
    "nav.log": "Log",
    "nav.milestones": "Milestones",
    "nav.guide": "Guide",
    "nav.safety": "Safety",

    // Emergency numbers (India)
    "emergency.ambulance": "102",
    "emergency.poison_control": "1800-599-0019",
    "emergency.pediatric_hotline": "102",

    // Volume units (metric default for India)
    "unit.volume.oz": "oz",
    "unit.volume.ml": "ml",

    // Temperature units (Celsius for India)
    "unit.temp.f": "°F",
    "unit.temp.c": "°C",

    // Common UI
    "btn.save": "Save",
    "btn.cancel": "Cancel",
    "btn.delete": "Delete",
    "btn.edit": "Edit",
    "btn.add": "Add",
    "msg.success": "Success!",
    "msg.error": "Error",
    "msg.loading": "Loading...",
  },

  "hi-IN": {
    // App title and main navigation
    "app.title": "BabyBloom",
    "nav.home": "होम",
    "nav.log": "लॉग",
    "nav.milestones": "माइलस्टोन्स",
    "nav.guide": "गाइड",
    "nav.safety": "सुरक्षा",

    // Emergency numbers (India)
    "emergency.ambulance": "102",
    "emergency.poison_control": "1800-599-0019",
    "emergency.pediatric_hotline": "102",

    // Volume units (metric default for India)
    "unit.volume.oz": "oz",
    "unit.volume.ml": "ml",

    // Temperature units (Celsius for India)
    "unit.temp.f": "°F",
    "unit.temp.c": "°C",

    // Common UI
    "btn.save": "सहेजें",
    "btn.cancel": "रद्द करें",
    "btn.delete": "हटाएं",
    "btn.edit": "संपादित करें",
    "btn.add": "जोड़ें",
    "msg.success": "सफल!",
    "msg.error": "त्रुटि",
    "msg.loading": "लोड हो रहा है...",
  },
};

// ═══ LOCALE DEFAULTS ═══

export interface LocaleDefaults {
  volumeUnit: VolumeUnit;
  temperatureUnit: TemperatureUnit;
  dateFormat: string; // e.g., "MM/DD/YYYY" or "DD/MM/YYYY"
  emergencyNumbers: {
    ambulance: string;
    poisonControl: string;
    pediatricHotline: string;
  };
}

export const localeDefaults: { [locale: string]: LocaleDefaults } = {
  "en-US": {
    volumeUnit: "oz",
    temperatureUnit: "F",
    dateFormat: "MM/DD/YYYY",
    emergencyNumbers: {
      ambulance: "911",
      poisonControl: "1-800-222-1222",
      pediatricHotline: "1-800-222-1222",
    },
  },

  "en-IN": {
    volumeUnit: "ml",
    temperatureUnit: "C",
    dateFormat: "DD/MM/YYYY",
    emergencyNumbers: {
      ambulance: "102",
      poisonControl: "1800-599-0019",
      pediatricHotline: "102",
    },
  },

  "hi-IN": {
    volumeUnit: "ml",
    temperatureUnit: "C",
    dateFormat: "DD/MM/YYYY",
    emergencyNumbers: {
      ambulance: "102",
      poisonControl: "1800-599-0019",
      pediatricHotline: "102",
    },
  },
};

// ═══ I18N HELPER FUNCTIONS ═══

/**
 * Translate a key to the user's locale
 * Falls back to en-US if translation not found
 * @param key Translation key (e.g., "nav.home")
 * @param locale Current locale
 * @returns Translated string
 */
export function t(key: string, locale: Locale = "en-US"): string {
  const trans = translations[locale];
  if (!trans || !trans[key]) {
    // Fallback to en-US
    return translations["en-US"][key] || key;
  }
  return trans[key];
}

/**
 * Get emergency number for current locale
 */
export function getEmergencyNumber(
  type: "ambulance" | "poisonControl" | "pediatricHotline",
  locale: Locale = "en-US"
): string {
  return localeDefaults[locale]?.emergencyNumbers[type] || "911";
}

/**
 * Get default volume unit for locale
 */
export function getVolumeUnit(locale: Locale = "en-US"): VolumeUnit {
  return localeDefaults[locale]?.volumeUnit || "oz";
}

/**
 * Get default temperature unit for locale
 */
export function getTemperatureUnit(locale: Locale = "en-US"): TemperatureUnit {
  return localeDefaults[locale]?.temperatureUnit || "F";
}

/**
 * Convert Celsius to Fahrenheit
 */
export function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

/**
 * Convert Fahrenheit to Celsius
 */
export function fahrenheitToCelsius(fahrenheit: number): number {
  return Math.round((((fahrenheit - 32) * 5) / 9) * 10) / 10;
}

/**
 * Format a date according to locale
 * @param dateStr ISO date string (YYYY-MM-DD)
 * @param locale Current locale
 * @returns Formatted date string
 */
export function formatDateForLocale(
  dateStr: string,
  locale: Locale = "en-US"
): string {
  const [year, month, day] = dateStr.split("-");

  if (locale.startsWith("en-IN") || locale === "hi-IN") {
    // DD/MM/YYYY for India
    return `${day}/${month}/${year}`;
  }

  // MM/DD/YYYY for US
  return `${month}/${day}/${year}`;
}

/**
 * Format a time according to locale
 * @param timeStr Time in HH:MM format
 * @param locale Current locale
 * @returns Formatted time string
 */
export function formatTimeForLocale(
  timeStr: string,
  locale: Locale = "en-US"
): string {
  if (!timeStr) return "";

  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours);

  // Most locales use 12-hour AM/PM format
  // Could extend this for other formats
  const ap = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;

  return `${displayH}:${minutes} ${ap}`;
}

/**
 * Format temperature for display
 */
export function formatTemperature(
  value: number,
  unit: TemperatureUnit
): string {
  return `${value}${unit === "F" ? "°F" : "°C"}`;
}

/**
 * Format volume for display
 */
export function formatVolume(
  value: number,
  unit: VolumeUnit
): string {
  return `${value} ${unit}`;
}
