import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialData } from '../src/lib/defaults.ts';
import { createBackup, deserialize, normalise, readBackup, serialize, toCSV } from '../src/storage/serialize.ts';
import type { AppData } from '../src/types.ts';

let n = 0;
const makeId = () => `id${(n += 1)}`;

function sample(): AppData {
  const data = createInitialData(makeId);
  const food = data.categories[0].id;
  data.transactions = [
    { id: 't1', amount: 1250, kind: 'expense', categoryId: food, date: '2026-03-01', note: 'Lunch, with "friends"', createdAt: 'a', updatedAt: 'a' },
    { id: 't2', amount: 500000, kind: 'income', categoryId: data.categories[10].id, date: '2026-03-02', note: 'Pay', createdAt: 'b', updatedAt: 'b' },
  ];
  data.budgets = [{ id: 'b1', categoryId: food, amount: 40000, month: null }];
  return data;
}

test('a full round trip through storage preserves everything', () => {
  const data = sample();
  assert.deepEqual(deserialize(serialize(data), makeId), data);
});

test('missing or corrupt storage yields a usable fresh ledger', () => {
  for (const input of [null, '', 'not json', '{"categories":']) {
    const data = deserialize(input, makeId);
    assert.ok(data.categories.length > 0);
    assert.equal(data.transactions.length, 0);
  }
});

test('rows pointing at categories that no longer exist are dropped', () => {
  const data = normalise(
    {
      categories: [{ id: 'c1', name: 'Food', icon: '🍽️', color: '#f00', kind: 'expense', archived: false }],
      transactions: [
        { id: 't1', amount: 100, kind: 'expense', categoryId: 'c1', date: '2026-03-01' },
        { id: 't2', amount: 100, kind: 'expense', categoryId: 'gone', date: '2026-03-01' },
      ],
      budgets: [{ id: 'b1', categoryId: 'gone', amount: 100, month: null }],
    },
    makeId
  );
  assert.deepEqual(data.transactions.map((t) => t.id), ['t1']);
  assert.equal(data.budgets.length, 0);
});

test('invalid dates and negative amounts are rejected or normalised', () => {
  const data = normalise(
    {
      categories: [{ id: 'c1', name: 'Food', icon: '🍽️', color: '#f00', kind: 'expense', archived: false }],
      transactions: [
        { id: 't1', amount: -500, kind: 'expense', categoryId: 'c1', date: '2026-03-01' },
        { id: 't2', amount: 100, kind: 'expense', categoryId: 'c1', date: '2026-02-30' },
        { id: 't3', amount: 100, kind: 'expense', categoryId: 'c1', date: 'yesterday' },
      ],
    },
    makeId
  );
  assert.deepEqual(data.transactions.map((t) => t.id), ['t1']);
  assert.equal(data.transactions[0].amount, 500); // sign lives in `kind`
});

test('float amounts from an older export are rounded to whole cents', () => {
  const data = normalise(
    {
      categories: [{ id: 'c1', name: 'Food', icon: '🍽️', color: '#f00', kind: 'expense', archived: false }],
      transactions: [{ id: 't1', amount: 1250.4, kind: 'expense', categoryId: 'c1', date: '2026-03-01' }],
    },
    makeId
  );
  assert.equal(data.transactions[0].amount, 1250);
});

test('out-of-range settings are clamped to something sane', () => {
  const data = normalise({ categories: [], settings: { monthStartDay: 99, reminderHour: 40, currency: 'eur', theme: 'neon' } }, makeId);
  assert.equal(data.settings.monthStartDay, 28);
  assert.equal(data.settings.reminderHour, 23);
  assert.equal(data.settings.currency, 'EUR');
  assert.equal(data.settings.theme, 'system');
});

test('a backup can be read back, and junk files are refused with a message', () => {
  const data = sample();
  const restored = readBackup(createBackup(data), makeId);
  assert.equal(restored.ok, true);
  if (restored.ok) assert.deepEqual(restored.data.transactions, data.transactions);

  assert.equal(readBackup('nonsense', makeId).ok, false);
  assert.equal(readBackup('{"hello":"world"}', makeId).ok, false);
  assert.equal(readBackup('[1,2,3]', makeId).ok, false);
});

test('a bare app-data file is accepted as a backup too', () => {
  const restored = readBackup(serialize(sample()), makeId);
  assert.equal(restored.ok, true);
});

test('CSV export escapes quotes and signs expenses negative', () => {
  const csv = toCSV(sample()).split('\n');
  assert.equal(csv[0], 'Date,Type,Category,Note,Amount');
  assert.ok(csv[1].startsWith('2026-03-02,income,'));
  assert.ok(csv[1].endsWith(',5000.00'));
  assert.ok(csv[2].includes('"Lunch, with ""friends"""'));
  assert.ok(csv[2].endsWith(',-12.50'));
});
