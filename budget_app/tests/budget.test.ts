import test from 'node:test';
import assert from 'node:assert/strict';

import { budgetStatuses, effectiveBudget, pace, summarise, transactionsInPeriod } from '../src/lib/budget.ts';
import { periodFor } from '../src/lib/dates.ts';
import type { Budget, Category, Transaction } from '../src/types.ts';

const categories: Category[] = [
  { id: 'food', name: 'Food', icon: '🍽️', color: '#f00', kind: 'expense', archived: false },
  { id: 'rent', name: 'Rent', icon: '🏠', color: '#00f', kind: 'expense', archived: false },
  { id: 'fun', name: 'Fun', icon: '🎬', color: '#0f0', kind: 'expense', archived: false },
  { id: 'old', name: 'Old', icon: '📦', color: '#999', kind: 'expense', archived: true },
  { id: 'pay', name: 'Salary', icon: '💼', color: '#0a0', kind: 'income', archived: false },
];

function tx(id: string, categoryId: string, amount: number, date: string, kind: 'expense' | 'income' = 'expense'): Transaction {
  return { id, amount, kind, categoryId, date, note: '', createdAt: '', updatedAt: '' };
}

const march = periodFor('2026-03-15', 1);

test('a month override beats the standing budget, which beats nothing', () => {
  const budgets: Budget[] = [
    { id: 'b1', categoryId: 'food', amount: 50000, month: null },
    { id: 'b2', categoryId: 'food', amount: 70000, month: '2026-03' },
  ];
  assert.equal(effectiveBudget(budgets, 'food', '2026-03'), 70000);
  assert.equal(effectiveBudget(budgets, 'food', '2026-04'), 50000);
  assert.equal(effectiveBudget(budgets, 'rent', '2026-03'), null);
});

test('only transactions inside the period are counted', () => {
  const rows = [
    tx('1', 'food', 100, '2026-02-28'),
    tx('2', 'food', 100, '2026-03-01'),
    tx('3', 'food', 100, '2026-03-31'),
    tx('4', 'food', 100, '2026-04-01'),
  ];
  assert.deepEqual(transactionsInPeriod(rows, march).map((t) => t.id), ['2', '3']);
});

test('budget status flags ok, warning and over', () => {
  const budgets: Budget[] = [
    { id: 'b1', categoryId: 'food', amount: 10000, month: null },
    { id: 'b2', categoryId: 'rent', amount: 10000, month: null },
    { id: 'b3', categoryId: 'fun', amount: 10000, month: null },
  ];
  const rows = [
    tx('1', 'food', 5000, '2026-03-02'),
    tx('2', 'rent', 8500, '2026-03-02'),
    tx('3', 'fun', 12000, '2026-03-02'),
  ];
  const byId = new Map(budgetStatuses(categories, budgets, rows, march).map((s) => [s.category.id, s]));
  assert.equal(byId.get('food')!.state, 'ok');
  assert.equal(byId.get('rent')!.state, 'warning');
  assert.equal(byId.get('fun')!.state, 'over');
  assert.equal(byId.get('fun')!.remaining, -2000);
  assert.equal(byId.get('food')!.progress, 0.5);
});

test('archived and income categories stay out of the budget list', () => {
  const ids = budgetStatuses(categories, [], [], march).map((s) => s.category.id);
  assert.deepEqual(ids.sort(), ['food', 'fun', 'rent']);
});

test('income never counts as spending', () => {
  const rows = [tx('1', 'pay', 500000, '2026-03-05', 'income'), tx('2', 'food', 2000, '2026-03-05')];
  const summary = summarise(categories, [], rows, march);
  assert.equal(summary.income, 500000);
  assert.equal(summary.expense, 2000);
  assert.equal(summary.net, 498000);
  assert.ok(Math.abs(summary.savingsRate - 0.996) < 1e-9);
});

test('savings rate is zero rather than infinite when there is no income', () => {
  const summary = summarise(categories, [], [tx('1', 'food', 2000, '2026-03-05')], march);
  assert.equal(summary.savingsRate, 0);
  assert.equal(summary.net, -2000);
});

test('summarise totals only budgeted categories for the budget figures', () => {
  const budgets: Budget[] = [{ id: 'b1', categoryId: 'food', amount: 10000, month: null }];
  const rows = [tx('1', 'food', 3000, '2026-03-05'), tx('2', 'fun', 9000, '2026-03-05')];
  const summary = summarise(categories, budgets, rows, march);
  assert.equal(summary.budgeted, 10000);
  assert.equal(summary.budgetedSpend, 3000);
  assert.equal(summary.expense, 12000);
});

test('pace projects to period end and suggests a safe daily amount', () => {
  // 10 days into a 31-day March, 1000 spent against a 3100 budget.
  const p = pace(march, 1000, 3100, '2026-03-10');
  assert.equal(p.daysElapsed, 10);
  assert.equal(p.daysTotal, 31);
  assert.equal(p.daysRemaining, 21);
  assert.equal(p.averagePerDay, 100);
  assert.equal(p.projected, 3100);
  assert.equal(p.safeDailySpend, 100);
});

test('pace clamps to the period when asked about a day outside it', () => {
  const before = pace(march, 500, 1000, '2026-02-01');
  assert.equal(before.daysElapsed, 1);
  const after = pace(march, 500, 1000, '2026-05-01');
  assert.equal(after.daysElapsed, 31);
  assert.equal(after.daysRemaining, 0);
  assert.equal(after.safeDailySpend, 0);
});

test('overspending never suggests a negative daily allowance', () => {
  const p = pace(march, 5000, 1000, '2026-03-10');
  assert.equal(p.safeDailySpend, 0);
});
