/** Aggregations behind the Reports tab. */

import type { Category, Transaction, TxKind } from '../types.ts';
import {
  addMonths,
  compareDates,
  formatMonthLabel,
  isWithin,
  periodFor,
  periodForKey,
  today,
  type ISODate,
  type MonthKey,
  type Period,
} from './dates.ts';
import { ratio } from './money.ts';

export type CategorySlice = {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  total: number;
  /** Share of the whole, 0..1. */
  share: number;
};

/** Totals per category for one direction of money, largest first. */
export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  kind: TxKind = 'expense'
): CategorySlice[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();
  let grand = 0;
  for (const t of transactions) {
    if (t.kind !== kind) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
    grand += t.amount;
  }
  const slices: CategorySlice[] = [];
  for (const [categoryId, total] of totals) {
    const category = byId.get(categoryId);
    slices.push({
      categoryId,
      name: category?.name ?? 'Uncategorised',
      color: category?.color ?? '#94A3B8',
      icon: category?.icon ?? '•',
      total,
      share: ratio(total, grand),
    });
  }
  return slices.sort((a, b) => b.total - a.total);
}

export type MonthlyTotal = {
  key: MonthKey;
  label: string;
  income: number;
  expense: number;
  net: number;
};

/** Income/expense per period for the last `count` periods, oldest first. */
export function monthlyTotals(
  transactions: Transaction[],
  count = 6,
  monthStartDay = 1,
  asOf: ISODate = today(),
  locale = 'en-US'
): MonthlyTotal[] {
  const current = periodFor(asOf, monthStartDay, locale);
  const periods: Period[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    periods.push(periodFor(addMonths(current.start, -i), monthStartDay, locale));
  }
  return periods.map((period) => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (!isWithin(t.date, period.start, period.end)) continue;
      if (t.kind === 'income') income += t.amount;
      else expense += t.amount;
    }
    return {
      key: period.key,
      label: formatMonthLabel(period.key, locale),
      income,
      expense,
      net: income - expense,
    };
  });
}

export type BalancePoint = { date: ISODate; balance: number };

/** Cumulative net position across a period, one point per day with activity. */
export function runningBalance(transactions: Transaction[], period: Period): BalancePoint[] {
  const rows = transactions
    .filter((t) => isWithin(t.date, period.start, period.end))
    .sort((a, b) => compareDates(a.date, b.date));
  const points: BalancePoint[] = [{ date: period.start, balance: 0 }];
  let balance = 0;
  for (const t of rows) {
    balance += t.kind === 'income' ? t.amount : -t.amount;
    const last = points[points.length - 1];
    if (last.date === t.date) last.balance = balance;
    else points.push({ date: t.date, balance });
  }
  return points;
}

export type TrendComparison = {
  current: number;
  previous: number;
  /** Signed change as a fraction of the previous period, or null if it was 0. */
  change: number | null;
};

/** This period against the one before it, for a single money direction. */
export function comparePeriods(
  transactions: Transaction[],
  period: Period,
  monthStartDay = 1,
  kind: TxKind = 'expense',
  locale = 'en-US'
): TrendComparison {
  const previous = periodFor(addMonths(period.start, -1), monthStartDay, locale);
  const total = (p: Period) => {
    let sum = 0;
    for (const t of transactions) {
      if (t.kind === kind && isWithin(t.date, p.start, p.end)) sum += t.amount;
    }
    return sum;
  };
  const current = total(period);
  const prev = total(previous);
  return { current, previous: prev, change: prev === 0 ? null : (current - prev) / prev };
}

/** Largest single expenses in a period. */
export function biggestExpenses(transactions: Transaction[], period: Period, limit = 5): Transaction[] {
  return transactions
    .filter((t) => t.kind === 'expense' && isWithin(t.date, period.start, period.end))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

/** Average spend per period over the last `count` periods, ignoring empty ones. */
export function averageMonthlySpend(
  transactions: Transaction[],
  count = 6,
  monthStartDay = 1,
  asOf: ISODate = today()
): number {
  const totals = monthlyTotals(transactions, count, monthStartDay, asOf).filter((m) => m.expense > 0);
  if (totals.length === 0) return 0;
  return Math.round(totals.reduce((acc, m) => acc + m.expense, 0) / totals.length);
}

export { periodForKey };
