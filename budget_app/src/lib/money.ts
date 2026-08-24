/**
 * Money helpers. Amounts are integer minor units (cents) everywhere in the
 * app; these functions are the only place that converts to or from a
 * human-facing decimal string.
 */

const MINOR_UNITS_PER_MAJOR = 100;

/** Currencies with no decimal subunit — these are the common ones. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX', 'RWF', 'XAF', 'XOF']);

export function decimalsFor(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}

/** Parse free-form user input ("12", "12.5", "1,234.56", "-3") into cents. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s ]/g, '').replace(/,/g, '.');
  if (cleaned === '' || cleaned === '.' || cleaned === '-') return null;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * MINOR_UNITS_PER_MAJOR);
}

/** Cents -> plain decimal string, no currency symbol. Used in text inputs. */
export function toDecimalString(cents: number, currency = 'USD'): string {
  const digits = decimalsFor(currency);
  const value = cents / MINOR_UNITS_PER_MAJOR;
  return value.toFixed(digits);
}

/**
 * Cents -> display string with the currency symbol.
 *
 * `Intl.NumberFormat` is available in Hermes with the `intl` polyfill Expo
 * ships, but a bad locale/currency pair throws — fall back to a plain format
 * rather than crashing a screen.
 */
export function formatMoney(
  cents: number,
  currency = 'USD',
  locale = 'en-US',
  options: { signed?: boolean; compact?: boolean } = {}
): string {
  const { signed = false, compact = false } = options;
  const digits = decimalsFor(currency);
  const value = cents / MINOR_UNITS_PER_MAJOR;
  let body: string;
  try {
    body = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: compact && Number.isInteger(value) ? 0 : digits,
      maximumFractionDigits: digits,
      notation: compact && Math.abs(value) >= 100000 ? 'compact' : 'standard',
    }).format(Math.abs(value));
  } catch {
    body = `${currency} ${Math.abs(value).toFixed(digits)}`;
  }
  if (signed && cents !== 0) return `${cents < 0 ? '−' : '+'}${body}`;
  return cents < 0 ? `−${body}` : body;
}

export function sum(values: number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** Percentage 0..1 of `part` against `whole`, guarding division by zero. */
export function ratio(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return part / whole;
}

/** Split `total` into `count` parts that add back up to exactly `total`. */
export function distribute(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.trunc(total / count);
  const parts = new Array(count).fill(base);
  let remainder = total - base * count;
  const step = remainder >= 0 ? 1 : -1;
  for (let i = 0; remainder !== 0; i = (i + 1) % count) {
    parts[i] += step;
    remainder -= step;
  }
  return parts;
}
