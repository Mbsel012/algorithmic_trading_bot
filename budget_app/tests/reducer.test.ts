import test from 'node:test';
import assert from 'node:assert/strict';

import { reducer, sortedTransactions } from '../src/state/reducer.ts';
import type { AppData, Category, RecurringRule, Transaction } from '../src/types.ts';
import { DEFAULT_SETTINGS } from '../src/lib/defaults.ts';

const categories: Category[] = [
  { id: 'food', name: 'Food', icon: '🍽️', color: '#f00', kind: 'expense', archived: false },
  { id: 'fun', name: 'Fun', icon: '🎬', color: '#0f0', kind: 'expense', archived: false },
];

function state(overrides: Partial<AppData> = {}): AppData {
  return {
    schemaVersion: 1,
    categories,
    transactions: [],
    budgets: [],
    recurring: [],
    goals: [],
    settings: { ...DEFAULT_SETTINGS },
    ...overrides,
  };
}

function tx(id: string, categoryId = 'food', date = '2026-03-01'): Transaction {
  return { id, amount: 1000, kind: 'expense', categoryId, date, note: '', createdAt: date, updatedAt: date };
}

test('adding, editing and deleting a transaction', () => {
  let s = reducer(state(), { type: 'transaction/add', transaction: tx('1') });
  assert.equal(s.transactions.length, 1);

  s = reducer(s, { type: 'transaction/update', transaction: { ...tx('1'), amount: 2500 } });
  assert.equal(s.transactions[0].amount, 2500);
  assert.equal(s.transactions.length, 1);

  s = reducer(s, { type: 'transaction/delete', id: '1' });
  assert.equal(s.transactions.length, 0);
});

test('the reducer never mutates the state it was given', () => {
  const before = state({ transactions: [tx('1')] });
  const snapshot = JSON.stringify(before);
  reducer(before, { type: 'transaction/add', transaction: tx('2') });
  reducer(before, { type: 'transaction/delete', id: '1' });
  reducer(before, { type: 'settings/update', patch: { currency: 'EUR' } });
  assert.equal(JSON.stringify(before), snapshot);
});

test('deleting a category in use archives it instead of orphaning rows', () => {
  const s = reducer(state({ transactions: [tx('1', 'food')] }), { type: 'category/delete', id: 'food' });
  assert.equal(s.categories.find((c) => c.id === 'food')!.archived, true);
  assert.equal(s.transactions[0].categoryId, 'food');
});

test('deleting a category with a replacement moves its rows across', () => {
  const start = state({
    transactions: [tx('1', 'food')],
    budgets: [{ id: 'b', categoryId: 'food', amount: 500, month: null }],
    recurring: [
      {
        id: 'r', name: 'Lunch', amount: 500, kind: 'expense', categoryId: 'food',
        frequency: 'weekly', startDate: '2026-01-01', endDate: null, lastPostedDate: null,
        autoPost: true, reminderDaysBefore: 0, active: true,
      },
    ],
  });
  const s = reducer(start, { type: 'category/delete', id: 'food', reassignTo: 'fun' });
  assert.equal(s.categories.some((c) => c.id === 'food'), false);
  assert.equal(s.transactions[0].categoryId, 'fun');
  assert.equal(s.recurring[0].categoryId, 'fun');
  assert.equal(s.budgets.length, 0); // budgets are per-category, so they go
});

test('an unused category is removed outright', () => {
  const s = reducer(state(), { type: 'category/delete', id: 'fun' });
  assert.deepEqual(s.categories.map((c) => c.id), ['food']);
});

test('setting a budget replaces the one for the same category and month', () => {
  let s = reducer(state(), { type: 'budget/set', budget: { id: 'b1', categoryId: 'food', amount: 1000, month: null } });
  s = reducer(s, { type: 'budget/set', budget: { id: 'b2', categoryId: 'food', amount: 2000, month: null } });
  assert.equal(s.budgets.length, 1);
  assert.equal(s.budgets[0].amount, 2000);

  s = reducer(s, { type: 'budget/set', budget: { id: 'b3', categoryId: 'food', amount: 3000, month: '2026-03' } });
  assert.equal(s.budgets.length, 2);
});

test('a budget of zero clears the budget rather than storing a zero limit', () => {
  let s = reducer(state(), { type: 'budget/set', budget: { id: 'b1', categoryId: 'food', amount: 1000, month: null } });
  s = reducer(s, { type: 'budget/set', budget: { id: 'b2', categoryId: 'food', amount: 0, month: null } });
  assert.equal(s.budgets.length, 0);
});

const rule: RecurringRule = {
  id: 'r1', name: 'Rent', amount: 120000, kind: 'expense', categoryId: 'food',
  frequency: 'monthly', startDate: '2026-01-01', endDate: null, lastPostedDate: null,
  autoPost: true, reminderDaysBefore: 2, active: true,
};

test('auto-post writes missed occurrences into the ledger once', () => {
  let n = 0;
  const makeId = () => `t${(n += 1)}`;
  const s = reducer(state({ recurring: [rule] }), {
    type: 'recurring/runAutoPost', asOf: '2026-03-05', makeId, now: 'NOW',
  });
  assert.deepEqual(s.transactions.map((t) => t.date), ['2026-03-01', '2026-02-01', '2026-01-01']);
  assert.equal(s.recurring[0].lastPostedDate, '2026-03-01');

  const again = reducer(s, { type: 'recurring/runAutoPost', asOf: '2026-03-05', makeId, now: 'NOW' });
  assert.equal(again, s); // unchanged state is returned as-is
});

test('skipping a bill advances the rule without touching the ledger', () => {
  const s = reducer(state({ recurring: [rule] }), { type: 'recurring/skip', ruleId: 'r1', date: '2026-02-01' });
  assert.equal(s.transactions.length, 0);
  assert.equal(s.recurring[0].lastPostedDate, '2026-02-01');
});

test('deleting a rule keeps its posted history but unlinks it', () => {
  const posted = { ...tx('1'), recurringId: 'r1' };
  const s = reducer(state({ recurring: [rule], transactions: [posted] }), { type: 'recurring/delete', id: 'r1' });
  assert.equal(s.recurring.length, 0);
  assert.equal(s.transactions.length, 1);
  assert.equal(s.transactions[0].recurringId, undefined);
});

test('goal contributions can be added and removed', () => {
  const goal = { id: 'g1', name: 'Trip', icon: '✈️', color: '#00f', targetAmount: 50000, targetDate: null, contributions: [], archived: false };
  let s = reducer(state({ goals: [goal] }), {
    type: 'goal/contribute', goalId: 'g1', contribution: { id: 'c1', amount: 10000, date: '2026-03-01', note: '' },
  });
  assert.equal(s.goals[0].contributions.length, 1);

  s = reducer(s, { type: 'goal/removeContribution', goalId: 'g1', contributionId: 'c1' });
  assert.equal(s.goals[0].contributions.length, 0);
});

test('settings updates merge instead of replacing', () => {
  const s = reducer(state(), { type: 'settings/update', patch: { currency: 'EUR' } });
  assert.equal(s.settings.currency, 'EUR');
  assert.equal(s.settings.locale, DEFAULT_SETTINGS.locale);
});

test('transactions sort newest first with a stable tiebreak', () => {
  const rows = [
    { ...tx('a'), date: '2026-03-01', createdAt: '2026-03-01T10:00:00Z' },
    { ...tx('b'), date: '2026-03-05', createdAt: '2026-03-05T10:00:00Z' },
    { ...tx('c'), date: '2026-03-01', createdAt: '2026-03-01T12:00:00Z' },
  ];
  assert.deepEqual(sortedTransactions(rows).map((t) => t.id), ['b', 'c', 'a']);
});
