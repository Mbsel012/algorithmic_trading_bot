import test from 'node:test';
import assert from 'node:assert/strict';

import { decimalsFor, distribute, formatMoney, parseAmount, ratio, toDecimalString } from '../src/lib/money.ts';

test('parseAmount reads the formats people actually type', () => {
  assert.equal(parseAmount('12'), 1200);
  assert.equal(parseAmount('12.5'), 1250);
  assert.equal(parseAmount('12.34'), 1234);
  assert.equal(parseAmount('0.05'), 5);
  assert.equal(parseAmount('12,50'), 1250); // comma as decimal separator
  assert.equal(parseAmount(' 7 '), 700);
});

test('parseAmount rejects junk instead of guessing', () => {
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('.'), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('1.2.3'), null);
});

test('parseAmount rounds to whole cents rather than keeping float dust', () => {
  assert.equal(parseAmount('0.1'), 10);
  assert.equal(parseAmount('19.999'), 2000);
  // 1.005 * 100 is 100.49999... in binary floating point.
  assert.equal(parseAmount('1.005'), 100);
});

test('cents survive a round trip through the input formatter', () => {
  for (const cents of [0, 1, 99, 100, 12345, 999999]) {
    assert.equal(parseAmount(toDecimalString(cents)), cents);
  }
});

test('formatMoney shows a minus for negatives and can force a sign', () => {
  assert.equal(formatMoney(1234, 'USD', 'en-US'), '$12.34');
  assert.equal(formatMoney(123456, 'USD', 'en-US'), '$1,234.56');
  assert.ok(formatMoney(-500, 'USD', 'en-US').startsWith('−'));
  assert.ok(formatMoney(500, 'USD', 'en-US', { signed: true }).startsWith('+'));
  assert.equal(formatMoney(0, 'USD', 'en-US', { signed: true }).startsWith('+'), false);
});

test('formatMoney falls back instead of throwing on a bad currency', () => {
  assert.match(formatMoney(1000, 'NOTACURRENCY', 'en-US'), /NOTACURRENCY/);
});

test('formatMoney drops decimals for zero-decimal currencies', () => {
  assert.equal(formatMoney(1000, 'JPY', 'en-US').includes('.'), false);
});

test('ratio guards against dividing by zero', () => {
  assert.equal(ratio(100, 0), 0);
  assert.equal(ratio(50, 200), 0.25);
});

test('distribute splits without losing or inventing cents', () => {
  assert.deepEqual(distribute(100, 3), [34, 33, 33]);
  assert.equal(distribute(1000, 7).reduce((a, b) => a + b, 0), 1000);
  assert.equal(distribute(-100, 3).reduce((a, b) => a + b, 0), -100);
  assert.deepEqual(distribute(50, 0), []);
});

test('currencies with no minor unit are not multiplied by a hundred', () => {
  assert.equal(parseAmount('1550', 'JPY'), 1550);
  assert.equal(toDecimalString(1550, 'JPY'), '1550');
  assert.equal(formatMoney(1550, 'JPY', 'en-US'), '¥1,550');
});

test('three-decimal currencies keep their third digit', () => {
  assert.equal(parseAmount('30.7', 'KWD'), 30700);
  assert.equal(toDecimalString(30700, 'KWD'), '30.700');
  for (const code of ['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']) {
    assert.equal(decimalsFor(code), 3, code);
  }
});

test('minor units round-trip for every scale', () => {
  for (const code of ['USD', 'JPY', 'KWD', 'EUR', 'XOF']) {
    for (const minor of [0, 1, 7, 12345]) {
      assert.equal(parseAmount(toDecimalString(minor, code), code), minor, `${code} ${minor}`);
    }
  }
});
