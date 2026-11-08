/**
 * Standardized player price formatting across the fantasy application.
 * Prices can fluctuate by cents (e.g. $5.03M).
 * Formatting with 2 decimal places ensures small price movements are never rounded away or hidden.
 */
export function formatPlayerPrice(price: number | null | undefined): string {
  if (price == null || Number.isNaN(Number(price))) {
    return '$0.00M';
  }
  return `$${Number(price).toFixed(2)}M`;
}

/**
 * Returns numeric value formatted with 2 decimals without currency symbols or suffixes.
 */
export function formatPriceNumber(price: number | null | undefined): string {
  if (price == null || Number.isNaN(Number(price))) {
    return '0.00';
  }
  return Number(price).toFixed(2);
}

