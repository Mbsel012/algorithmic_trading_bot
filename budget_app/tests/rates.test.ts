import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRatesResponse } from '../src/lib/rates.ts';

test('a normal response becomes a usable rate table', () => {
  const result = parseRatesResponse(
    { result: 'success', base_code: 'USD', rates: { USD: 1, EUR: 0.92, JPY: 155 } },
    'USD'
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.table.base, 'USD');
  assert.equal(result.table.rates.EUR, 0.92);
  assert.equal(result.table.source, 'network');
  assert.notEqual(result.table.updatedAt, null);
});

test('the provider base wins over the requested one', () => {
  const result = parseRatesResponse({ base_code: 'EUR', rates: { USD: 1.08 } }, 'USD');
  assert.equal(result.ok && result.table.base, 'EUR');
});

test('an error response is reported, not silently swallowed', () => {
  const result = parseRatesResponse({ result: 'error', 'error-type': 'unsupported-code' }, 'USD');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /unsupported-code/);
});

test('junk payloads are refused rather than producing empty rates', () => {
  for (const payload of [null, 'nope', 42, {}, { rates: null }, { rates: {} }]) {
    assert.equal(parseRatesResponse(payload, 'USD').ok, false, JSON.stringify(payload));
  }
});

test('non-numeric rate values are dropped', () => {
  const result = parseRatesResponse({ base_code: 'USD', rates: { EUR: 0.92, GBP: 'x', JPY: null } }, 'USD');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(Object.keys(result.table.rates).sort(), ['EUR', 'USD']);
});

test('the base is always convertible to itself', () => {
  const result = parseRatesResponse({ base_code: 'NGN', rates: { USD: 0.00065 } }, 'NGN');
  assert.equal(result.ok && result.table.rates.NGN, 1);
});
