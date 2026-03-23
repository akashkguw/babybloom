/**
 * Shared utility types used across the application
 */

/**
 * Locale supported by the app
 */
export type Locale = "en-US" | "en-IN" | "hi-IN";

/**
 * Volume unit (ounces or milliliters)
 */
export type VolumeUnit = "oz" | "ml";

/**
 * Temperature unit (Fahrenheit or Celsius)
 */
export type TemperatureUnit = "F" | "C";

/**
 * Theme mode
 */
export type ThemeMode = "light" | "dark" | "auto";

/**
 * Feeding type
 */
export type FeedingType = "breast" | "formula" | "combination";

/**
 * Feeding method
 */
export type FeedingMethod = "bottle" | "breast" | "both";

/**
 * Repeat frequency for reminders
 */
export type RepeatFrequency = "daily" | "weekly" | "monthly" | "once";

/**
 * Sleep type for logging
 */
export type SleepType = "Nap" | "Night Sleep" | "Tummy Time" | "Wake Up";

/**
 * Diaper log type
 */
export type DiaperType = "Wet" | "Dirty" | "Both";

/**
 * Generic async result wrapper
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Generic callback function
 */
export type Callback<T> = (value: T) => void;
