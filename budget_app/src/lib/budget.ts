/** Budget maths: what was spent, what is left, and how the pace looks. */

import type { Budget, Category, Transaction } from '../types.ts';
import { diffDays, isWithin, today, type ISODate, type MonthKey, type Period } from './dates.ts';
import { ratio } from './money.ts';

export type BudgetState = 'none' | 'ok' | 'warning' | 'over';

/** Fraction of a budget spent before the row is flagged amber. */
const WARNING_THRESHOLD = 0.8;

export type CategoryBudgetStatus = {
  category: Category;
  /** Limit in cents, or null when the category has no budget set. */
  budget: number | null;
  spent: number;
  /** Positive means money left; negative means overspent. */
  remaining: number;
  /** 0..1+, uncapped so the UI can show "140%". */
  progress: number;
  state: BudgetState;
};

/**
 * The limit in force for a category in a given period: a month-specific
 * override wins over the standing monthly budget.
 */
export function effectiveBudget(budgets: Budget[], categoryId: string, month: MonthKey): number | null {
  let standing: number | null = null;
  for (const b of budgets) {
    if (b.categoryId !== categoryId) continue;
    if (b.month === month) return b.amount;
    if (b.month === null) standing = b.amount;
  }
  return standing;
}

export function transactionsInPeriod(transactions: Transaction[], period: Period): Transaction[] {
  return transactions.filter((t) => isWithin(t.date, period.start, period.end));
}

/** Total spend per category id within the given transactions. */
export function spendByCategory(transactions: Transaction[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.kind !== 'expense') continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }
  return totals;
}

export function budgetStatuses(
  categories: Category[],
  budgets: Budget[],
  transactions: Transaction[],
  period: Period
): CategoryBudgetStatus[] {
  const spend = spendByCategory(transactionsInPeriod(transactions, period));
  return categories
    .filter((c) => c.kind === 'expense' && !c.archived)
    .map((category) => {
      const budget = effectiveBudget(budgets, category.id, period.key);
      const spent = spend.get(category.id) ?? 0;
      const remaining = budget === null ? 0 : budget - spent;
      const progress = budget === null ? 0 : ratio(spent, budget);
      let state: BudgetState = 'none';
      if (budget !== null) {
        state = spent > budget ? 'over' : progress >= WARNING_THRESHOLD ? 'warning' : 'ok';
      }
      return { category, budget, spent, remaining, progress, state };
    })
    .sort((a, b) => {
      // Budgeted categories first, then by spend.
      if ((a.budget === null) !== (b.budget === null)) return a.budget === null ? 1 : -1;
      return b.spent - a.spent;
    });
}

export type PeriodSummary = {
  income: number;
  expense: number;
  net: number;
  budgeted: number;
  /** Spend against budgeted categories only. */
  budgetedSpend: number;
  /** 0..1 share of income kept. Zero when there is no income. */
  savingsRate: number;
  transactionCount: number;
};

export function summarise(
  categories: Category[],
  budgets: Budget[],
  transactions: Transaction[],
  period: Period
): PeriodSummary {
  const rows = transactionsInPeriod(transactions, period);
  let income = 0;
  let expense = 0;
  for (const t of rows) {
    if (t.kind === 'income') income += t.amount;
    else expense += t.amount;
  }
  const spend = spendByCategory(rows);
  let budgeted = 0;
  let budgetedSpend = 0;
  for (const category of categories) {
    if (category.kind !== 'expense' || category.archived) continue;
    const limit = effectiveBudget(budgets, category.id, period.key);
    if (limit === null) continue;
    budgeted += limit;
    budgetedSpend += spend.get(category.id) ?? 0;
  }
  const net = income - expense;
  return {
    income,
    expense,
    net,
    budgeted,
    budgetedSpend,
    savingsRate: income > 0 ? Math.max(0, net) / income : 0,
    transactionCount: rows.length,
  };
}

export type Pace = {
  /** Days elapsed in the period, at least 1. */
  daysElapsed: number;
  daysTotal: number;
  daysRemaining: number;
  averagePerDay: number;
  /** Spend extrapolated to the end of the period at the current rate. */
  projected: number;
  /** What is safe to spend per remaining day to land on budget. */
  safeDailySpend: number | null;
};

/** How the period is tracking, given how much of it has gone by. */
export function pace(
  period: Period,
  spent: number,
  budget: number | null,
  asOf: ISODate = today()
): Pace {
  const daysTotal = diffDays(period.start, period.end) + 1;
  const rawElapsed = diffDays(period.start, asOf) + 1;
  const daysElapsed = Math.min(Math.max(rawElapsed, 1), daysTotal);
  const daysRemaining = Math.max(daysTotal - daysElapsed, 0);
  const averagePerDay = Math.round(spent / daysElapsed);
  return {
    daysElapsed,
    daysTotal,
    daysRemaining,
    averagePerDay,
    projected: averagePerDay * daysTotal,
    safeDailySpend:
      budget === null ? null : daysRemaining > 0 ? Math.max(0, Math.round((budget - spent) / daysRemaining)) : 0,
  };
}
