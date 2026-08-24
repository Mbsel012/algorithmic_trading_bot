/**
 * Core domain types.
 *
 * All monetary values are stored as integer minor units (e.g. cents) to keep
 * arithmetic exact. Never store money as a float.
 */

export type TxKind = 'expense' | 'income';

export type Category = {
  id: string;
  name: string;
  /** Emoji shown in lists — keeps the bundle free of icon assets. */
  icon: string;
  /** Hex colour used by charts and chips. */
  color: string;
  kind: TxKind;
  archived: boolean;
};

export type Transaction = {
  id: string;
  /** Always positive. `kind` carries the direction. */
  amount: number;
  kind: TxKind;
  categoryId: string;
  /** Calendar day in `YYYY-MM-DD`, local time. */
  date: string;
  note: string;
  /** Set when the row was generated from a recurring rule. */
  recurringId?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * A spending limit for one category. `month` is `null` for the standing
 * monthly limit, or `YYYY-MM` for a one-month override.
 */
export type Budget = {
  id: string;
  categoryId: string;
  amount: number;
  month: string | null;
};

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export type RecurringRule = {
  id: string;
  name: string;
  amount: number;
  kind: TxKind;
  categoryId: string;
  frequency: Frequency;
  /** First occurrence, `YYYY-MM-DD`. */
  startDate: string;
  /** Inclusive last day the rule may fire, or null for open-ended. */
  endDate: string | null;
  /** Latest occurrence already written into the ledger, or null. */
  lastPostedDate: string | null;
  /** Write occurrences into the ledger automatically once they come due. */
  autoPost: boolean;
  /** Days of lead time on the reminder. 0 disables the reminder. */
  reminderDaysBefore: number;
  active: boolean;
};

export type GoalContribution = {
  id: string;
  amount: number;
  date: string;
  note: string;
};

export type Goal = {
  id: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  /** Target date in `YYYY-MM-DD`, or null for no deadline. */
  targetDate: string | null;
  contributions: GoalContribution[];
  archived: boolean;
};

export type ThemePreference = 'system' | 'light' | 'dark';

export type Settings = {
  currency: string;
  locale: string;
  theme: ThemePreference;
  /** Day of month a budget period starts on (1-28). */
  monthStartDay: number;
  remindersEnabled: boolean;
  /** Local time reminders fire, `HH:MM`. */
  reminderHour: number;
  reminderMinute: number;
  onboarded: boolean;
};

export type AppData = {
  schemaVersion: number;
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringRule[];
  goals: Goal[];
  settings: Settings;
};
