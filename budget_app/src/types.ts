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
  /**
   * Set when the amount was entered in a currency other than the home one.
   * `amount` always holds the converted home-currency figure, so every total
   * in the app stays addable; this records what was actually paid.
   */
  original?: { amount: number; currency: string; rate: number };
  /** Tax portion of `amount`, in minor units, when the user recorded one. */
  taxAmount?: number;
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
  /**
   * Ring like an alarm rather than arriving as a quiet banner. Used for the
   * bills that genuinely hurt to miss.
   */
  alarm: boolean;
  /** Mirror this rule's occurrences into the device calendar. */
  addToCalendar: boolean;
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

export type TaxMode = 'inclusive' | 'exclusive';

/**
 * Exchange rates, expressed as units of each currency per one unit of `base`.
 * Part of the ledger rather than device state, so backups carry them.
 */
export type RateTable = {
  base: string;
  rates: Record<string, number>;
  updatedAt: string | null;
  source: 'manual' | 'network';
};

export type Settings = {
  currency: string;
  locale: string;
  theme: ThemePreference;
  /** ISO 3166-1 alpha-2, used to seed currency and tax rate. Null = not set. */
  countryCode: string | null;
  /** Standard consumption-tax rate as a percentage. Editable, not authoritative. */
  taxRate: number;
  /** Local name for the tax: VAT, GST, IVA, Sales tax… */
  taxLabel: string;
  /** Whether prices are typically entered with tax already inside them. */
  taxMode: TaxMode;
  /** Mirror bills into the device calendar. */
  calendarEnabled: boolean;
  /** Calendar chosen to hold bill events, or null for the app's own. */
  calendarId: string | null;
  /**
   * Allow one outbound request to fetch exchange rates. Off by default: with
   * it off the app makes no network calls of any kind.
   */
  onlineRatesEnabled: boolean;
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
  rates: RateTable;
  settings: Settings;
};
