/**
 * Money helpers. Amounts are integer minor units (cents) everywhere in the
 * app; these functions are the only place that converts to or from a
 * human-facing decimal string.
 */

/**
 * Currencies whose minor unit is not 1/100.
 *
 * Assuming two decimals everywhere is wrong for a large part of the world: it
 * would multiply every yen amount by a hundred and divide every Kuwaiti dinar
 * by ten. Both lists follow ISO 4217.
 */
const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF',
  'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

const THREE_DECIMAL = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

export function decimalsFor(currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL.has(code)) return 0;
  if (THREE_DECIMAL.has(code)) return 3;
  return 2;
}

/** Minor units in one major unit of `currency` — 1, 100 or 1000. */
export function minorUnitsPer(currency: string): number {
  return 10 ** decimalsFor(currency);
}

/**
 * Parse free-form user input ("12", "12.5", "1,234.56", "-3") into minor units.
 *
 * The currency decides the scale, so the same "12.5" is 1250 in dollars, 12 in
 * yen and 12500 in dinars.
 */
export function parseAmount(input: string, currency = 'USD'): number | null {
  const cleaned = input.replace(/[\s ]/g, '').replace(/,/g, '.');
  if (cleaned === '' || cleaned === '.' || cleaned === '-') return null;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * minorUnitsPer(currency));
}

/** Minor units -> plain decimal string, no symbol. Used in text inputs. */
export function toDecimalString(minor: number, currency = 'USD'): string {
  return (minor / minorUnitsPer(currency)).toFixed(decimalsFor(currency));
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
  const value = cents / minorUnitsPer(currency);
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
