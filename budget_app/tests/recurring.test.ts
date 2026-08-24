import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dueOccurrences,
  monthlyEquivalent,
  nextDueDate,
  occurrencesBetween,
  postDueTransactions,
  upcoming,
} from '../src/lib/recurring.ts';
import type { RecurringRule } from '../src/types.ts';

function rule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'r1',
    name: 'Rent',
    amount: 120000,
    kind: 'expense',
    categoryId: 'c1',
    frequency: 'monthly',
    startDate: '2026-01-31',
    endDate: null,
    lastPostedDate: null,
    autoPost: true,
    reminderDaysBefore: 2,
    active: true,
    ...overrides,
  };
}

test('a monthly bill on the 31st returns to the 31st after short months', () => {
  const dates = occurrencesBetween(rule(), '2026-01-01', '2026-05-31');
  assert.deepEqual(dates, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
});

test('weekly and biweekly rules step by whole weeks', () => {
  const weekly = occurrencesBetween(rule({ frequency: 'weekly', startDate: '2026-01-05' }), '2026-01-01', '2026-02-02');
  assert.deepEqual(weekly, ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26', '2026-02-02']);

  const biweekly = occurrencesBetween(rule({ frequency: 'biweekly', startDate: '2026-01-05' }), '2026-01-01', '2026-02-02');
  assert.deepEqual(biweekly, ['2026-01-05', '2026-01-19', '2026-02-02']);
});

test('quarterly and yearly rules step by months', () => {
  const quarterly = occurrencesBetween(rule({ frequency: 'quarterly', startDate: '2026-01-15' }), '2026-01-01', '2026-12-31');
  assert.deepEqual(quarterly, ['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15']);

  const yearly = occurrencesBetween(rule({ frequency: 'yearly', startDate: '2026-06-01' }), '2026-01-01', '2029-01-01');
  assert.deepEqual(yearly, ['2026-06-01', '2027-06-01', '2028-06-01']);
});

test('an end date stops the series', () => {
  const dates = occurrencesBetween(rule({ endDate: '2026-03-01' }), '2026-01-01', '2026-12-31');
  assert.deepEqual(dates, ['2026-01-31', '2026-02-28']);
});

test('a window starting years after the rule still lands on the right days', () => {
  const dates = occurrencesBetween(rule({ startDate: '2020-01-15' }), '2026-03-01', '2026-05-01');
  assert.deepEqual(dates, ['2026-03-15', '2026-04-15']);
});

test('due occurrences pick up where the last posting left off', () => {
  const r = rule({ lastPostedDate: '2026-02-28' });
  assert.deepEqual(dueOccurrences(r, '2026-04-15'), ['2026-03-31']);
  assert.deepEqual(dueOccurrences(r, '2026-02-28'), []);
});

test('an inactive rule is never due and has no next date', () => {
  const r = rule({ active: false });
  assert.deepEqual(dueOccurrences(r, '2026-12-31'), []);
  assert.equal(nextDueDate(r, '2026-01-01'), null);
});

test('nextDueDate looks strictly ahead of the given day', () => {
  assert.equal(nextDueDate(rule(), '2026-01-31'), '2026-02-28');
  assert.equal(nextDueDate(rule(), '2026-01-30'), '2026-01-31');
  assert.equal(nextDueDate(rule({ endDate: '2026-02-01' }), '2026-02-01'), null);
});

test('auto-post writes one transaction per missed occurrence and advances the rule', () => {
  let n = 0;
  const { transactions, rules } = postDueTransactions([rule()], '2026-03-15', () => `t${(n += 1)}`, 'NOW');
  assert.deepEqual(transactions.map((t) => t.date), ['2026-01-31', '2026-02-28']);
  assert.equal(rules[0].lastPostedDate, '2026-02-28');
  assert.equal(transactions[0].amount, 120000);
  assert.equal(transactions[0].recurringId, 'r1');
  assert.equal(transactions[0].note, 'Rent');
});

test('auto-post is idempotent when run twice on the same day', () => {
  const first = postDueTransactions([rule()], '2026-03-15', () => 'x', 'NOW');
  const second = postDueTransactions(first.rules, '2026-03-15', () => 'y', 'NOW');
  assert.equal(second.transactions.length, 0);
  assert.deepEqual(second.rules, first.rules);
});

test('rules with auto-post off are left for the user to confirm', () => {
  const { transactions, rules } = postDueTransactions([rule({ autoPost: false })], '2026-06-01', () => 'x', 'NOW');
  assert.equal(transactions.length, 0);
  assert.equal(rules[0].lastPostedDate, null);
});

test('upcoming lists what falls due inside the horizon, soonest first', () => {
  const rules = [
    rule({ id: 'a', name: 'Rent', startDate: '2026-03-05', frequency: 'monthly' }),
    rule({ id: 'b', name: 'Gym', startDate: '2026-03-02', frequency: 'weekly' }),
  ];
  const list = upcoming(rules, 10, '2026-03-01');
  assert.deepEqual(
    list.map((u) => [u.rule.name, u.date, u.daysAway]),
    [
      ['Gym', '2026-03-02', 1],
      ['Rent', '2026-03-05', 4],
      ['Gym', '2026-03-09', 8],
    ]
  );
});

test('monthlyEquivalent normalises every frequency', () => {
  assert.equal(monthlyEquivalent(rule({ amount: 1200, frequency: 'monthly' })), 1200);
  assert.equal(monthlyEquivalent(rule({ amount: 1200, frequency: 'yearly' })), 100);
  assert.equal(monthlyEquivalent(rule({ amount: 300, frequency: 'quarterly' })), 100);
  assert.equal(monthlyEquivalent(rule({ amount: 1000, frequency: 'weekly' })), 4333);
});
