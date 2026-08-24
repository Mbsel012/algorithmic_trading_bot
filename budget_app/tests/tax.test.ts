import test from 'node:test';
import assert from 'node:assert/strict';

import { effectiveRate, formatRate, isValidRate, split, splitExclusive, splitInclusive } from '../src/lib/tax.ts';
import { COUNTRIES, findCountry, searchCountries } from '../src/lib/countries.ts';

test('an inclusive price is split so the parts add back to the total', () => {
  const result = splitInclusive(12000, 20); // £120.00 including 20% VAT
  assert.equal(result.net, 10000);
  assert.equal(result.tax, 2000);
  assert.equal(result.net + result.tax, result.gross);
});

test('an exclusive price adds tax on top', () => {
  const result = splitExclusive(10000, 20);
  assert.equal(result.tax, 2000);
  assert.equal(result.gross, 12000);
});

test('the two directions are inverses of each other', () => {
  for (const rate of [5, 7.5, 8.1, 15, 19.25, 20, 27]) {
    const gross = splitExclusive(50000, rate).gross;
    assert.equal(splitInclusive(gross, rate).net, 50000, `rate ${rate}`);
  }
});

test('awkward amounts still reconstitute exactly', () => {
  for (const amount of [1, 7, 99, 333, 1234, 99999]) {
    for (const rate of [5, 8.1, 12.5, 19.25, 27]) {
      const inc = splitInclusive(amount, rate);
      assert.equal(inc.net + inc.tax, amount, `${amount} @ ${rate}`);
      const exc = splitExclusive(amount, rate);
      assert.equal(exc.net + exc.tax, exc.gross, `${amount} @ ${rate}`);
    }
  }
});

test('a zero rate is a no-op in both directions', () => {
  assert.deepEqual(splitInclusive(5000, 0), { net: 5000, tax: 0, gross: 5000 });
  assert.deepEqual(splitExclusive(5000, 0), { net: 5000, tax: 0, gross: 5000 });
});

test('nonsense rates are ignored rather than producing nonsense money', () => {
  assert.equal(isValidRate(-5), false);
  assert.equal(isValidRate(150), false);
  assert.equal(isValidRate(Number.NaN), false);
  assert.equal(splitInclusive(5000, -5).tax, 0);
  assert.equal(splitExclusive(5000, Number.NaN).gross, 5000);
});

test('split dispatches on the mode', () => {
  assert.equal(split(12000, 20, 'inclusive').net, 10000);
  assert.equal(split(12000, 20, 'exclusive').gross, 14400);
});

test('effective rate recovers the percentage that was applied', () => {
  const { net, tax } = splitInclusive(12000, 20);
  assert.ok(Math.abs(effectiveRate(net, tax) - 20) < 1e-9);
  assert.equal(effectiveRate(0, 500), 0);
});

test('rates format without trailing noise, keeping real precision', () => {
  assert.equal(formatRate(20), '20%');
  assert.equal(formatRate(8.1), '8.1%');
  assert.equal(formatRate(19.25), '19.25%');
  // A US local rate must not be rounded away to 8.88%.
  assert.equal(formatRate(8.875), '8.875%');
});

test('the country table is well formed and covers the world', () => {
  assert.ok(COUNTRIES.length > 180, `only ${COUNTRIES.length} countries`);
  const codes = new Set<string>();
  for (const country of COUNTRIES) {
    assert.match(country.code, /^[A-Z]{2}$/, country.name);
    assert.match(country.currency, /^[A-Z]{3}$/, country.name);
    assert.ok(isValidRate(country.taxRate), `${country.name} rate ${country.taxRate}`);
    assert.ok(country.name.length > 1);
    assert.equal(codes.has(country.code), false, `duplicate ${country.code}`);
    codes.add(country.code);
  }
});

test('countries can be looked up and searched', () => {
  assert.equal(findCountry('ET')?.currency, 'ETB');
  assert.equal(findCountry('et')?.name, 'Ethiopia');
  assert.equal(findCountry('ZZ'), undefined);
  assert.equal(findCountry(null), undefined);
  assert.equal(searchCountries('ethiop')[0].code, 'ET');
  assert.equal(searchCountries('')?.length, COUNTRIES.length);
});

test('the United States preset carries its caveat rather than a made-up rate', () => {
  const us = findCountry('US')!;
  assert.equal(us.taxRate, 0);
  assert.ok(us.note && us.note.length > 10);
});
