import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  addMonths,
  diffDays,
  fromISODate,
  isValidISODate,
  monthKey,
  periodFor,
  shiftPeriod,
  toISODate,
} from '../src/lib/dates.ts';

test('ISO days round trip through Date without shifting', () => {
  for (const iso of ['2026-01-01', '2026-02-28', '2026-12-31', '2024-02-29']) {
    assert.equal(toISODate(fromISODate(iso)), iso);
  }
});

test('addMonths clamps to the end of short months', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29'); // leap year
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(addMonths('2026-01-15', -1), '2025-12-15');
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});

test('diffDays counts whole days in both directions', () => {
  assert.equal(diffDays('2026-01-01', '2026-01-31'), 30);
  assert.equal(diffDays('2026-01-31', '2026-01-01'), -30);
  assert.equal(diffDays('2026-03-01', '2026-03-01'), 0);
});

test('isValidISODate rejects impossible days', () => {
  assert.ok(isValidISODate('2026-02-28'));
  assert.ok(isValidISODate('2024-02-29'));
  assert.equal(isValidISODate('2026-02-30'), false);
  assert.equal(isValidISODate('2026-13-01'), false);
  assert.equal(isValidISODate('2026-1-1'), false);
  assert.equal(isValidISODate('not a date'), false);
});

test('a month-start of 1 gives plain calendar months', () => {
  const period = periodFor('2026-03-17', 1);
  assert.equal(period.start, '2026-03-01');
  assert.equal(period.end, '2026-03-31');
  assert.equal(period.key, '2026-03');
});

test('a payday month-start shifts the window and keeps the ending month as key', () => {
  const period = periodFor('2026-03-26', 25);
  assert.equal(period.start, '2026-03-25');
  assert.equal(period.end, '2026-04-24');
  assert.equal(period.key, '2026-04');

  // A day before the 25th belongs to the window that opened last month.
  const earlier = periodFor('2026-03-24', 25);
  assert.equal(earlier.start, '2026-02-25');
  assert.equal(earlier.end, '2026-03-24');
});

test('consecutive periods tile the calendar with no gaps or overlaps', () => {
  let period = periodFor('2026-01-10', 25);
  for (let i = 0; i < 24; i += 1) {
    const next = shiftPeriod(period, 1, 25);
    assert.equal(addDays(period.end, 1), next.start, `gap after ${period.end}`);
    period = next;
  }
});

test('monthKey takes the year-month prefix', () => {
  assert.equal(monthKey('2026-07-04'), '2026-07');
});
