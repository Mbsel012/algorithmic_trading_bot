import test from 'node:test';
import assert from 'node:assert/strict';

import { periodFor } from '../src/lib/dates.ts';
import {
  averageMonthlySpend,
  biggestExpenses,
  categoryBreakdown,
  comparePeriods,
  monthlyTotals,
  runningBalance,
} from '../src/lib/reports.ts';
import type { Category, Transaction } from '../src/types.ts';

const categories: Category[] = [
  { id: 'food', name: 'Food', icon: '🍽️', color: '#f00', kind: 'expense', archived: false },
  { id: 'fun', name: 'Fun', icon: '🎬', color: '#0f0', kind: 'expense', archived: false },
  { id: 'pay', name: 'Salary', icon: '💼', color: '#0a0', kind: 'income', archived: false },
];

function tx(id: string, categoryId: string, amount: number, date: string, kind: 'expense' | 'income' = 'expense'): Transaction {
  return { id, amount, kind, categoryId, date, note: '', createdAt: '', updatedAt: '' };
}

test('category breakdown sorts by size and shares add up to one', () => {
  const rows = [
    tx('1', 'food', 3000, '2026-03-01'),
    tx('2', 'fun', 7000, '2026-03-02'),
    tx('3', 'pay', 90000, '2026-03-03', 'income'),
  ];
  const slices = categoryBreakdown(rows, categories, 'expense');
  assert.deepEqual(slices.map((s) => s.name), ['Fun', 'Food']);
  assert.equal(slices[0].share, 0.7);
  assert.ok(Math.abs(slices.reduce((a, s) => a + s.share, 0) - 1) < 1e-9);
});

test('breakdown labels unknown categories instead of dropping the money', () => {
  const slices = categoryBreakdown([tx('1', 'ghost', 500, '2026-03-01')], categories);
  assert.equal(slices[0].name, 'Uncategorised');
  assert.equal(slices[0].total, 500);
});

test('monthly totals cover the requested window, oldest first', () => {
  const rows = [
    tx('1', 'food', 1000, '2026-01-15'),
    tx('2', 'food', 2000, '2026-02-15'),
    tx('3', 'pay', 5000, '2026-03-15', 'income'),
  ];
  const totals = monthlyTotals(rows, 3, 1, '2026-03-20');
  assert.deepEqual(totals.map((m) => m.key), ['2026-01', '2026-02', '2026-03']);
  assert.deepEqual(totals.map((m) => m.expense), [1000, 2000, 0]);
  assert.deepEqual(totals.map((m) => m.net), [-1000, -2000, 5000]);
});

test('running balance accumulates and collapses same-day activity', () => {
  const rows = [
    tx('1', 'pay', 10000, '2026-03-01', 'income'),
    tx('2', 'food', 1000, '2026-03-05'),
    tx('3', 'fun', 2000, '2026-03-05'),
  ];
  const points = runningBalance(rows, periodFor('2026-03-10', 1));
  assert.deepEqual(points, [
    { date: '2026-03-01', balance: 10000 },
    { date: '2026-03-05', balance: 7000 },
  ]);
});

test('running balance on an empty period is just the opening point', () => {
  assert.deepEqual(runningBalance([], periodFor('2026-03-10', 1)), [
    { date: '2026-03-01', balance: 0 },
  ]);
});

test('period comparison reports the signed change, and null against a zero base', () => {
  const rows = [tx('1', 'food', 1000, '2026-02-10'), tx('2', 'food', 1500, '2026-03-10')];
  const withBase = comparePeriods(rows, periodFor('2026-03-10', 1), 1, 'expense');
  assert.equal(withBase.current, 1500);
  assert.equal(withBase.previous, 1000);
  assert.ok(Math.abs(withBase.change! - 0.5) < 1e-9);

  const noBase = comparePeriods(rows, periodFor('2026-02-10', 1), 1, 'expense');
  assert.equal(noBase.change, null);
});

test('biggest expenses ignores income and respects the limit', () => {
  const rows = [
    tx('1', 'food', 100, '2026-03-01'),
    tx('2', 'fun', 900, '2026-03-02'),
    tx('3', 'pay', 99999, '2026-03-03', 'income'),
    tx('4', 'food', 500, '2026-03-04'),
  ];
  const top = biggestExpenses(rows, periodFor('2026-03-10', 1), 2);
  assert.deepEqual(top.map((t) => t.id), ['2', '4']);
});

test('average monthly spend skips months with no spending', () => {
  const rows = [tx('1', 'food', 3000, '2026-02-10'), tx('2', 'food', 1000, '2026-03-10')];
  assert.equal(averageMonthlySpend(rows, 3, 1, '2026-03-20'), 2000);
  assert.equal(averageMonthlySpend([], 3, 1, '2026-03-20'), 0);
});
