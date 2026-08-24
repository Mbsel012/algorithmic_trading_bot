/**
 * Optional exchange-rate refresh.
 *
 * This is the ONLY code in the app that opens a network connection, and it
 * runs only when the user turns it on and taps refresh. The request carries no
 * personal data — no transactions, no identifiers, just "give me today's rates
 * against this currency". The provider does of course see the device's IP
 * address, which the settings screen states before the toggle is switched on.
 *
 * With the toggle off, rates are typed in by hand and the app is fully offline.
 */

import { applyFetchedRates } from './currency.ts';
import type { RateTable } from '../types.ts';

/** Public, key-less, no sign-up. Documented at open.er-api.com. */
const ENDPOINT = 'https://open.er-api.com/v6/latest';

const TIMEOUT_MS = 12000;

export type FetchOutcome =
  | { ok: true; table: RateTable }
  | { ok: false; error: string };

/**
 * Pull the rate map out of a provider response.
 *
 * Kept separate from the request itself so the parsing — the part that can
 * silently corrupt someone's converted totals — is unit tested.
 */
export function parseRatesResponse(payload: unknown, requestedBase: string): FetchOutcome {
  if (typeof payload !== 'object' || payload === null) {
    return { ok: false, error: 'The rates service sent something unreadable.' };
  }
  const body = payload as Record<string, unknown>;

  if (typeof body.result === 'string' && body.result !== 'success') {
    const detail = typeof body['error-type'] === 'string' ? body['error-type'] : 'unknown error';
    return { ok: false, error: `The rates service refused the request (${detail}).` };
  }

  const rates = body.rates;
  if (typeof rates !== 'object' || rates === null) {
    return { ok: false, error: 'The rates service sent no rates.' };
  }

  const base =
    typeof body.base_code === 'string'
      ? body.base_code
      : typeof body.base === 'string'
        ? body.base
        : requestedBase;

  const numeric: Record<string, number> = {};
  for (const [code, value] of Object.entries(rates as Record<string, unknown>)) {
    if (typeof value === 'number') numeric[code] = value;
  }
  if (Object.keys(numeric).length === 0) {
    return { ok: false, error: 'The rates service sent no usable rates.' };
  }

  const table = applyFetchedRates(base, numeric);
  // A table that cannot convert its own base back is not worth storing.
  if (!table.rates[table.base]) table.rates[table.base] = 1;
  return { ok: true, table };
}

/** Fetch today's rates against `base`. Never called unless the user opted in. */
export async function fetchRates(base: string): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(base.toUpperCase())}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return { ok: false, error: `The rates service replied ${response.status}.` };
    }
    return parseRatesResponse(await response.json(), base);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, error: 'The rates service took too long to answer.' };
    }
    return { ok: false, error: 'Could not reach the rates service. Check your connection.' };
  } finally {
    clearTimeout(timer);
  }
}
