/**
 * Recurring rule engine.
 *
 * Every occurrence is derived from the rule's `startDate` rather than from the
 * previous occurrence, so a bill on the 31st still lands on the 31st in months
 * that have one, instead of drifting to the 28th after February.
 */

import type { Frequency, RecurringRule, Transaction, TxKind } from '../types.ts';
import { addDays, addMonths, compareDates, diffDays, today, type ISODate } from './dates.ts';

/** Hard stop so a malformed rule can never spin forever. */
const MAX_OCCURRENCES = 2000;

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Every 3 months',
  yearly: 'Yearly',
};

/** Roughly how many days a frequency spans — used only for loop estimates. */
const APPROX_DAYS: Record<Frequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};

export function occurrenceAt(rule: Pick<RecurringRule, 'startDate' | 'frequency'>, index: number): ISODate {
  switch (rule.frequency) {
    case 'weekly':
      return addDays(rule.startDate, 7 * index);
    case 'biweekly':
      return addDays(rule.startDate, 14 * index);
    case 'monthly':
      return addMonths(rule.startDate, index);
    case 'quarterly':
      return addMonths(rule.startDate, 3 * index);
    case 'yearly':
      return addMonths(rule.startDate, 12 * index);
  }
}

function endsBefore(rule: RecurringRule, date: ISODate): boolean {
  return rule.endDate !== null && compareDates(date, rule.endDate) > 0;
}

/** Every occurrence of `rule` in `[from, to]`, inclusive, oldest first. */
export function occurrencesBetween(rule: RecurringRule, from: ISODate, to: ISODate): ISODate[] {
  const result: ISODate[] = [];
  if (compareDates(from, to) > 0) return result;

  // Skip ahead instead of walking from the start date, which may be years back.
  const lead = diffDays(rule.startDate, from);
  let index = lead > 0 ? Math.max(0, Math.floor(lead / APPROX_DAYS[rule.frequency]) - 1) : 0;

  for (let guard = 0; guard < MAX_OCCURRENCES; guard += 1) {
    const date = occurrenceAt(rule, index);
    index += 1;
    if (compareDates(date, from) < 0) continue;
    if (compareDates(date, to) > 0) break;
    if (endsBefore(rule, date)) break;
    result.push(date);
  }
  return result;
}

/**
 * Occurrences that have come due but were never written to the ledger:
 * everything after `lastPostedDate` (or from `startDate`) up to `asOf`.
 */
export function dueOccurrences(rule: RecurringRule, asOf: ISODate = today()): ISODate[] {
  if (!rule.active) return [];
  const from = rule.lastPostedDate ? addDays(rule.lastPostedDate, 1) : rule.startDate;
  return occurrencesBetween(rule, from, asOf);
}

/** The next occurrence strictly after `asOf`, or null if the rule has ended. */
export function nextDueDate(rule: RecurringRule, asOf: ISODate = today()): ISODate | null {
  if (!rule.active) return null;
  const from = addDays(asOf, 1);
  const horizon = addMonths(from, 24);
  const [next] = occurrencesBetween(rule, from, horizon);
  return next ?? null;
}

export type UpcomingOccurrence = {
  rule: RecurringRule;
  date: ISODate;
  daysAway: number;
};

/** Everything falling due in the next `days`, soonest first. */
export function upcoming(
  rules: RecurringRule[],
  days = 30,
  asOf: ISODate = today()
): UpcomingOccurrence[] {
  const horizon = addDays(asOf, days);
  const result: UpcomingOccurrence[] = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    // An unposted occurrence dated today still counts as upcoming.
    const from = rule.lastPostedDate && compareDates(rule.lastPostedDate, asOf) >= 0
      ? addDays(rule.lastPostedDate, 1)
      : asOf;
    for (const date of occurrencesBetween(rule, from, horizon)) {
      result.push({ rule, date, daysAway: diffDays(asOf, date) });
    }
  }
  return result.sort((a, b) => compareDates(a.date, b.date) || a.rule.name.localeCompare(b.rule.name));
}

export type PostedResult = {
  transactions: Transaction[];
  /** Rules with their `lastPostedDate` advanced. */
  rules: RecurringRule[];
};

type IdFactory = () => string;

/**
 * Materialise every due occurrence of every auto-posting rule into
 * transactions. Rules with `autoPost` off are left alone — they only show up
 * as reminders until the user confirms them.
 */
export function postDueTransactions(
  rules: RecurringRule[],
  asOf: ISODate = today(),
  makeId: IdFactory = () => Math.random().toString(36).slice(2),
  now: string = new Date().toISOString()
): PostedResult {
  const transactions: Transaction[] = [];
  const nextRules = rules.map((rule) => {
    if (!rule.active || !rule.autoPost) return rule;
    const due = dueOccurrences(rule, asOf);
    if (due.length === 0) return rule;
    for (const date of due) {
      transactions.push(buildTransaction(rule, date, makeId(), now));
    }
    return { ...rule, lastPostedDate: due[due.length - 1] };
  });
  return { transactions, rules: nextRules };
}

/** Turn one occurrence of a rule into a ledger row. */
export function buildTransaction(
  rule: RecurringRule,
  date: ISODate,
  id: string,
  now: string = new Date().toISOString()
): Transaction {
  return {
    id,
    amount: rule.amount,
    kind: rule.kind as TxKind,
    categoryId: rule.categoryId,
    date,
    note: rule.name,
    recurringId: rule.id,
    createdAt: now,
    updatedAt: now,
  };
}

/** Total per period for a set of rules, normalised to a monthly figure. */
export function monthlyEquivalent(rule: RecurringRule): number {
  switch (rule.frequency) {
    case 'weekly':
      return Math.round((rule.amount * 52) / 12);
    case 'biweekly':
      return Math.round((rule.amount * 26) / 12);
    case 'monthly':
      return rule.amount;
    case 'quarterly':
      return Math.round(rule.amount / 3);
    case 'yearly':
      return Math.round(rule.amount / 12);
  }
}
