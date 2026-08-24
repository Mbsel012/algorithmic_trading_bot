/**
 * Multi-currency support.
 *
 * A rate table is a base currency plus "how many of X you get for one base
 * unit". Any pair is converted by crossing through the base, which keeps one
 * number per currency instead of a full matrix.
 *
 * Conversions must go through major units: a currency's minor unit is not
 * always 1/100 (JPY has none, KWD has three), so converting cents to cents
 * directly would be wrong for a third of the world.
 */

import { decimalsFor } from './money.ts';

export type RateSource = 'manual' | 'network';

export type RateTable = {
  /** Currency every rate is expressed against. */
  base: string;
  /** code -> units of that currency per 1 unit of base. Base itself is 1. */
  rates: Record<string, number>;
  /** ISO timestamp the rates were last set, or null if never. */
  updatedAt: string | null;
  source: RateSource;
};

export const EMPTY_RATES: RateTable = { base: 'USD', rates: { USD: 1 }, updatedAt: null, source: 'manual' };

/** Rates older than this are shown as stale — currencies move. */
export const STALE_AFTER_DAYS = 7;

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase().slice(0, 3);
}

/** A currency code is exactly three letters — checked before any truncation. */
export function isValidCode(code: string): boolean {
  return /^[A-Za-z]{3}$/.test(code.trim());
}

/**
 * Units of `to` per one unit of `from`, or null when either side is missing.
 * Crossing through the base is exact enough here; the rounding that matters
 * happens once, at the end of `convert`.
 */
export function crossRate(from: string, to: string, table: RateTable): number | null {
  const a = normaliseCode(from);
  const b = normaliseCode(to);
  if (a === b) return 1;

  const rateFrom = a === table.base ? 1 : table.rates[a];
  const rateTo = b === table.base ? 1 : table.rates[b];
  if (!isUsableRate(rateFrom) || !isUsableRate(rateTo)) return null;
  return rateTo / rateFrom;
}

function isUsableRate(rate: number | undefined): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0;
}

/**
 * Convert an amount in minor units to another currency's minor units.
 * Returns null when the pair cannot be crossed with the rates on hand.
 */
export function convert(
  amountMinor: number,
  from: string,
  to: string,
  table: RateTable
): number | null {
  const rate = crossRate(from, to, table);
  if (rate === null) return null;

  const fromMajor = amountMinor / 10 ** decimalsFor(from);
  const toMajor = fromMajor * rate;
  return Math.round(toMajor * 10 ** decimalsFor(to));
}

/** Every currency the table can convert, including the base, sorted. */
export function availableCurrencies(table: RateTable): string[] {
  const codes = new Set<string>([table.base]);
  for (const [code, rate] of Object.entries(table.rates)) {
    if (isUsableRate(rate)) codes.add(code);
  }
  return [...codes].sort();
}

export function hasRate(code: string, table: RateTable): boolean {
  const normalised = normaliseCode(code);
  return normalised === table.base || isUsableRate(table.rates[normalised]);
}

/**
 * Set one rate by hand.
 *
 * Rates are entered the way people read them on a board — "1 USD = 57.2 PHP" —
 * so the input is already units-per-base and goes in unchanged.
 */
export function setRate(table: RateTable, code: string, perBase: number): RateTable {
  const normalised = normaliseCode(code);
  if (normalised === table.base) return table;
  if (!isUsableRate(perBase)) return table;
  return {
    ...table,
    rates: { ...table.rates, [normalised]: perBase },
    updatedAt: new Date().toISOString(),
    source: 'manual',
  };
}

export function removeRate(table: RateTable, code: string): RateTable {
  const normalised = normaliseCode(code);
  if (normalised === table.base) return table;
  const next = { ...table.rates };
  delete next[normalised];
  return { ...table, rates: next };
}

/**
 * Re-express the whole table against a new base, keeping every pair's
 * relationship intact. Used when the user changes their home currency.
 */
export function rebase(table: RateTable, newBase: string): RateTable {
  const target = normaliseCode(newBase);
  if (target === table.base) return table;

  const rateOfTarget = table.rates[target];
  if (!isUsableRate(rateOfTarget)) {
    // Nothing to anchor to — start a fresh table rather than invent rates.
    return { base: target, rates: { [target]: 1 }, updatedAt: null, source: table.source };
  }

  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(table.rates)) {
    if (!isUsableRate(rate) || code === target) continue;
    rates[code] = rate / rateOfTarget;
  }
  // The old base becomes an ordinary entry.
  rates[table.base] = 1 / rateOfTarget;
  return { base: target, rates, updatedAt: table.updatedAt, source: table.source };
}

/** Merge fetched rates in, dropping anything unusable. */
export function applyFetchedRates(
  base: string,
  fetched: Record<string, number>,
  at: string = new Date().toISOString()
): RateTable {
  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(fetched)) {
    // Validate before normalising: truncating first would turn "BADCODE"
    // into the perfectly plausible "BAD".
    if (!isValidCode(code) || !isUsableRate(rate)) continue;
    rates[normaliseCode(code)] = rate;
  }
  return { base: normaliseCode(base), rates, updatedAt: at, source: 'network' };
}

export function isStale(table: RateTable, now: Date = new Date()): boolean {
  if (!table.updatedAt) return true;
  const age = now.getTime() - new Date(table.updatedAt).getTime();
  if (!Number.isFinite(age)) return true;
  return age >= STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

/** "today", "3 days ago", "never" — for the rate-table header. */
export function describeAge(table: RateTable, now: Date = new Date()): string {
  if (!table.updatedAt) return 'never updated';
  const days = Math.floor((now.getTime() - new Date(table.updatedAt).getTime()) / 86400000);
  if (!Number.isFinite(days) || days < 0) return 'updated recently';
  if (days === 0) return 'updated today';
  if (days === 1) return 'updated yesterday';
  return `updated ${days} days ago`;
}
