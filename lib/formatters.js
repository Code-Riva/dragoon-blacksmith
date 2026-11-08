/**
 * Formatting utilities for BigInt and token unit precision.
 * No floating-point arithmetic is used.
 */

/**
 * Format a BigInt or numeric string with thousand separators (commas).
 * Pure string regex transformation ensures safe handling of any length.
 * @param {bigint|string|null} val
 * @returns {string}
 */
export function formatBigIntWithCommas(val) {
  if (val === null || val === undefined) return "0";
  const str = typeof val === "bigint" ? val.toString() : String(val);
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Provides a human-readable scale label (Million, Billion, Trillion, Quadrillion)
 * using string length and BigInt operations without floating point.
 * @param {bigint|null} supplyBigInt
 * @returns {string}
 */
export function getSupplyScaleLabel(supplyBigInt) {
  if (!supplyBigInt || supplyBigInt === 0n) return "";

  const str = supplyBigInt.toString();
  const len = str.length;

  if (len >= 16) return "Quadrillions+";
  if (len >= 13) return "Trillions";
  if (len >= 10) return "Billions";
  if (len >= 7) return "Millions";
  if (len >= 4) return "Thousands";
  return "";
}

/**
 * Formats a BigInt raw token base unit value into exact string representation.
 * @param {bigint|null} baseUnitsBigInt
 * @returns {string}
 */
export function formatBaseUnitsString(baseUnitsBigInt) {
  if (!baseUnitsBigInt) return "0";
  return baseUnitsBigInt.toString();
}

// Backward compatibility alias
export const formatWeiString = formatBaseUnitsString;
