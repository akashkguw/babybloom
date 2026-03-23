/**
 * Volume conversion utilities
 * Converts between ounces (oz) and milliliters (ml)
 */

export const ML_PER_OZ = 29.5735;

/**
 * Convert ounces to milliliters
 */
export function ozToMl(oz: number | string | undefined): number {
  return Math.round(parseFloat(oz?.toString() || "0") * ML_PER_OZ * 10) / 10;
}

/**
 * Convert milliliters to ounces
 */
export function mlToOz(ml: number | string | undefined): number {
  return Math.round(parseFloat(ml?.toString() || "0") / ML_PER_OZ * 100) / 100;
}

/**
 * Format volume for display
 * @param oz Amount in ounces
 * @param unit "ml" or "oz"
 * @returns Formatted string like "4.5 oz" or "132 ml"
 */
export function fmtVol(
  oz: number | string | undefined,
  unit: "oz" | "ml"
): string {
  if (!oz && oz !== 0) return "";

  if (unit === "ml") {
    return Math.round(ozToMl(oz)) + " ml";
  }

  return Math.round(parseFloat(oz.toString()) * 10) / 10 + " oz";
}

/**
 * Get the label for a volume unit
 */
export function volLabel(unit: "oz" | "ml" | undefined): string {
  return unit === "ml" ? "ml" : "oz";
}
