import test from 'node:test';
import assert from 'node:assert/strict';

import { goalProgress, sortGoals, summariseGoals } from '../src/lib/goals.ts';
import type { Goal } from '../src/types.ts';

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    name: 'Emergency fund',
    icon: '🎯',
    color: '#22C55E',
    targetAmount: 100000,
    targetDate: null,
    contributions: [],
    archived: false,
    ...overrides,
  };
}

const contribution = (id: string, amount: number, date = '2026-01-01') => ({ id, amount, date, note: '' });

test('progress sums contributions and reports what is left', () => {
  const p = goalProgress(goal({ contributions: [contribution('a', 25000), contribution('b', 15000)] }), '2026-03-01');
  assert.equal(p.saved, 40000);
  assert.equal(p.remaining, 60000);
  assert.equal(p.progress, 0.4);
  assert.equal(p.complete, false);
});

test('progress caps at 100% and remaining never goes negative', () => {
  const p = goalProgress(goal({ contributions: [contribution('a', 150000)] }), '2026-03-01');
  assert.equal(p.progress, 1);
  assert.equal(p.remaining, 0);
  assert.equal(p.complete, true);
});

test('a goal with no target is not silently complete', () => {
  const p = goalProgress(goal({ targetAmount: 0 }), '2026-03-01');
  assert.equal(p.complete, false);
  assert.equal(p.progress, 0);
});

test('required monthly amount follows the deadline', () => {
  const p = goalProgress(goal({ targetDate: '2026-07-01' }), '2026-03-01');
  assert.equal(p.daysLeft, 122);
  assert.equal(p.requiredPerMonth, 25000); // 100000 over 4 months
  assert.equal(p.overdue, false);
});

test('a missed deadline is flagged and asks for the whole remainder', () => {
  const p = goalProgress(goal({ targetDate: '2026-01-01', contributions: [contribution('a', 40000)] }), '2026-03-01');
  assert.ok(p.daysLeft! < 0);
  assert.equal(p.overdue, true);
  assert.equal(p.requiredPerMonth, 60000);
});

test('a completed goal is never overdue', () => {
  const p = goalProgress(goal({ targetDate: '2026-01-01', contributions: [contribution('a', 100000)] }), '2026-03-01');
  assert.equal(p.overdue, false);
  assert.equal(p.requiredPerMonth, null);
});

test('sorting puts live goals first, soonest deadline first, finished last', () => {
  const goals = [
    goal({ id: 'done', contributions: [contribution('a', 100000)] }),
    goal({ id: 'later', targetDate: '2026-12-01' }),
    goal({ id: 'soon', targetDate: '2026-04-01' }),
    goal({ id: 'undated' }),
  ];
  assert.deepEqual(sortGoals(goals, '2026-03-01').map((g) => g.id), ['soon', 'later', 'undated', 'done']);
});

test('the summary ignores archived goals', () => {
  const goals = [
    goal({ id: 'a', targetAmount: 100000, contributions: [contribution('x', 50000)] }),
    goal({ id: 'b', targetAmount: 100000, contributions: [contribution('y', 100000)] }),
    goal({ id: 'c', targetAmount: 999999, archived: true }),
  ];
  const s = summariseGoals(goals, '2026-03-01');
  assert.equal(s.totalSaved, 150000);
  assert.equal(s.totalTarget, 200000);
  assert.equal(s.progress, 0.75);
  assert.equal(s.activeCount, 1);
  assert.equal(s.completedCount, 1);
});
