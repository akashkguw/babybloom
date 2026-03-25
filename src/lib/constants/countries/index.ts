/**
 * Country Registry
 *
 * Central registry for all supported countries.
 * To add a new country:
 * 1. Create a new file (e.g., uk.ts) implementing CountryConfig
 * 2. Import and register it here
 * 3. Add the country code to CountryCode type in types.ts
 * That's it — the entire app automatically adapts.
 */

export type { CountryConfig, CountryCode } from './types';
export { US_CONFIG } from './us';
export { IN_CONFIG } from './in';

import type { CountryConfig, CountryCode } from './types';
import { US_CONFIG } from './us';
import { IN_CONFIG } from './in';

// ═══ COUNTRY REGISTRY ═══
const COUNTRIES: Record<CountryCode, CountryConfig> = {
  US: US_CONFIG,
  IN: IN_CONFIG,
};

/**
 * Get country config by code.
 * Falls back to US if code not found.
 */
export function getCountryConfig(code: CountryCode): CountryConfig {
  return COUNTRIES[code] || COUNTRIES.US;
}

/**
 * Get all available countries (for country selector UI)
 */
export function getAvailableCountries(): Array<{ code: CountryCode; name: string; flag: string }> {
  return Object.values(COUNTRIES).map((c) => ({
    code: c.code as CountryCode,
    name: c.name,
    flag: c.flag,
  }));
}

/**
 * Get default country code.
 * Attempts to detect from browser locale, falls back to US.
 */
export function detectCountry(): CountryCode {
  if (typeof navigator === 'undefined') return 'US';

  const lang = navigator.language || '';
  // Check for Indian locale
  if (lang.includes('IN') || lang === 'hi') return 'IN';

  // Default to US for English
  return 'US';
}

/**
 * Default country
 */
export const DEFAULT_COUNTRY: CountryCode = 'US';
