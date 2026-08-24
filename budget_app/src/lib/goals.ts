/** Savings-goal progress and pacing. */

import type { Goal } from '../types.ts';
import { compareDates, diffDays, today, type ISODate } from './dates.ts';
import { ratio, sum } from './money.ts';

export type GoalProgress = {
  saved: number;
  remaining: number;
  /** 0..1, capped at 1 for display. */
  progress: number;
  complete: boolean;
  /** Days until the target date; negative when overdue. Null with no date. */
  daysLeft: number | null;
  /** What must be set aside each month to hit the target date. */
  requiredPerMonth: number | null;
  /** True when the deadline has passed and the goal is unmet. */
  overdue: boolean;
};

export function savedAmount(goal: Goal): number {
  return sum(goal.contributions.map((c) => c.amount));
}

export function goalProgress(goal: Goal, asOf: ISODate = today()): GoalProgress {
  const saved = savedAmount(goal);
  const remaining = Math.max(0, goal.targetAmount - saved);
  const complete = goal.targetAmount > 0 && saved >= goal.targetAmount;
  const daysLeft = goal.targetDate ? diffDays(asOf, goal.targetDate) : null;
  let requiredPerMonth: number | null = null;
  if (goal.targetDate && !complete) {
    // Round rather than ceil: a 4.02-month deadline is four contributions,
    // not five, and overstating the runway understates the monthly ask.
    const months = Math.max(1, Math.round((daysLeft ?? 0) / 30.44));
    requiredPerMonth = daysLeft !== null && daysLeft <= 0 ? remaining : Math.ceil(remaining / months);
  }
  return {
    saved,
    remaining,
    progress: Math.min(1, ratio(saved, goal.targetAmount)),
    complete,
    daysLeft,
    requiredPerMonth,
    overdue: !complete && daysLeft !== null && daysLeft < 0,
  };
}

/** Goals sorted for the list: active and soonest-due first, done last. */
export function sortGoals(goals: Goal[], asOf: ISODate = today()): Goal[] {
  return [...goals].sort((a, b) => {
    const pa = goalProgress(a, asOf);
    const pb = goalProgress(b, asOf);
    if (pa.complete !== pb.complete) return pa.complete ? 1 : -1;
    if (a.targetDate && b.targetDate) return compareDates(a.targetDate, b.targetDate);
    if (a.targetDate) return -1;
    if (b.targetDate) return 1;
    return b.targetAmount - a.targetAmount;
  });
}

export type GoalsSummary = {
  totalSaved: number;
  totalTarget: number;
  progress: number;
  activeCount: number;
  completedCount: number;
};

export function summariseGoals(goals: Goal[], asOf: ISODate = today()): GoalsSummary {
  let totalSaved = 0;
  let totalTarget = 0;
  let activeCount = 0;
  let completedCount = 0;
  for (const goal of goals) {
    if (goal.archived) continue;
    const p = goalProgress(goal, asOf);
    totalSaved += p.saved;
    totalTarget += goal.targetAmount;
    if (p.complete) completedCount += 1;
    else activeCount += 1;
  }
  return {
    totalSaved,
    totalTarget,
    progress: ratio(totalSaved, totalTarget),
    activeCount,
    completedCount,
  };
}
