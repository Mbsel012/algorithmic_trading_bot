import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyFetchedRates,
  availableCurrencies,
  convert,
  crossRate,
  describeAge,
  hasRate,
  isStale,
  rebase,
  removeRate,
  setRate,
  type RateTable,
} from '../src/lib/currency.ts';

function table(): RateTable {
  return {
    base: 'USD',
    rates: { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 155, ETB: 57.5, KWD: 0.307 },
    updatedAt: '2026-08-20T00:00:00.000Z',
    source: 'manual',
  };
}

test('a currency converted to itself is unchanged', () => {
  assert.equal(convert(12345, 'USD', 'USD', table()), 12345);
  assert.equal(convert(12345, 'EUR', 'EUR', table()), 12345);
});

test('converting from the base applies the rate directly', () => {
  // $100.00 at 0.92 EUR per USD.
  assert.equal(convert(10000, 'USD', 'EUR', table()), 9200);
});

test('converting to the base inverts the rate', () => {
  assert.equal(convert(9200, 'EUR', 'USD', table()), 10000);
});

test('two non-base currencies cross through the base', () => {
  // 100 EUR -> USD -> GBP = 100 / 0.92 * 0.79
  const result = convert(10000, 'EUR', 'GBP', table());
  assert.equal(result, Math.round((10000 / 0.92) * 0.79));
});

test('currencies with no minor unit are handled, not divided by 100 anyway', () => {
  // $10.00 at 155 JPY per USD is ¥1550 — 1550 minor units, since JPY has none.
  assert.equal(convert(1000, 'USD', 'JPY', table()), 1550);
  // And back again.
  assert.equal(convert(1550, 'JPY', 'USD', table()), 1000);
});

test('a three-decimal currency keeps its third decimal', () => {
  // $100.00 at 0.307 KWD per USD = 30.700 KWD = 30700 minor units.
  assert.equal(convert(10000, 'USD', 'KWD', table()), 30700);
});

test('an unknown currency yields null rather than a wrong number', () => {
  assert.equal(convert(10000, 'USD', 'XYZ', table()), null);
  assert.equal(convert(10000, 'XYZ', 'USD', table()), null);
  assert.equal(crossRate('USD', 'XYZ', table()), null);
});

test('a zero or negative rate is treated as missing', () => {
  const broken: RateTable = { ...table(), rates: { ...table().rates, EUR: 0, GBP: -1 } };
  assert.equal(convert(100, 'USD', 'EUR', broken), null);
  assert.equal(convert(100, 'USD', 'GBP', broken), null);
  assert.equal(hasRate('EUR', broken), false);
});

test('codes are matched case-insensitively and trimmed', () => {
  assert.equal(convert(10000, ' usd ', 'eur', table()), 9200);
  assert.equal(hasRate('eur', table()), true);
});

test('setting a rate records it and marks the table manual', () => {
  const next = setRate({ ...table(), source: 'network' }, 'php', 57.2);
  assert.equal(next.rates.PHP, 57.2);
  assert.equal(next.source, 'manual');
  assert.notEqual(next.updatedAt, null);
});

test('the base rate cannot be overwritten and bad rates are refused', () => {
  const start = table();
  assert.equal(setRate(start, 'USD', 5).rates.USD, 1);
  assert.equal(setRate(start, 'EUR', 0), start);
  assert.equal(setRate(start, 'EUR', -2), start);
});

test('removing a rate drops it but never the base', () => {
  assert.equal(removeRate(table(), 'EUR').rates.EUR, undefined);
  assert.equal(removeRate(table(), 'USD').rates.USD, 1);
});

test('rebasing keeps every pair converting the same way', () => {
  const original = table();
  const rebased = rebase(original, 'EUR');
  assert.equal(rebased.base, 'EUR');
  // A EUR->JPY conversion must agree before and after the rebase.
  const before = convert(10000, 'EUR', 'JPY', original)!;
  const after = convert(10000, 'EUR', 'JPY', rebased)!;
  assert.ok(Math.abs(before - after) <= 1, `${before} vs ${after}`);
  // The old base survives as an ordinary entry.
  assert.ok(Math.abs(rebased.rates.USD - 1 / 0.92) < 1e-9);
});

test('rebasing to a currency with no rate starts a clean table instead of guessing', () => {
  const rebased = rebase(table(), 'ZAR');
  assert.equal(rebased.base, 'ZAR');
  assert.deepEqual(Object.keys(rebased.rates), ['ZAR']);
  assert.equal(rebased.updatedAt, null);
});

test('rebasing to the current base changes nothing', () => {
  const start = table();
  assert.equal(rebase(start, 'USD'), start);
});

test('fetched rates are filtered down to usable three-letter codes', () => {
  const applied = applyFetchedRates('usd', { eur: 0.9, GBP: 0.8, BADCODE: 5, JPY: 0, NGN: 1600 }, 'T');
  assert.deepEqual(Object.keys(applied.rates).sort(), ['EUR', 'GBP', 'NGN']);
  assert.equal(applied.base, 'USD');
  assert.equal(applied.source, 'network');
  assert.equal(applied.updatedAt, 'T');
});

test('available currencies include the base and exclude broken entries', () => {
  const broken: RateTable = { ...table(), rates: { ...table().rates, EUR: 0 } };
  const codes = availableCurrencies(broken);
  assert.ok(codes.includes('USD'));
  assert.equal(codes.includes('EUR'), false);
  assert.deepEqual(codes, [...codes].sort());
});

test('staleness is measured in days, and never-updated counts as stale', () => {
  const fresh: RateTable = { ...table(), updatedAt: '2026-08-20T00:00:00.000Z' };
  assert.equal(isStale(fresh, new Date('2026-08-22T00:00:00Z')), false);
  assert.equal(isStale(fresh, new Date('2026-09-01T00:00:00Z')), true);
  assert.equal(isStale({ ...table(), updatedAt: null }), true);
});

test('rate age reads in plain words', () => {
  const t: RateTable = { ...table(), updatedAt: '2026-08-20T00:00:00.000Z' };
  assert.equal(describeAge(t, new Date('2026-08-20T06:00:00Z')), 'updated today');
  assert.equal(describeAge(t, new Date('2026-08-21T06:00:00Z')), 'updated yesterday');
  assert.equal(describeAge(t, new Date('2026-08-25T06:00:00Z')), 'updated 5 days ago');
  assert.equal(describeAge({ ...t, updatedAt: null }), 'never updated');
});
