/**
 * Turning app state into JSON and back.
 *
 * Everything coming in from disk or from a user-supplied backup file is
 * treated as untrusted: each field is checked and bad rows are dropped rather
 * than allowed to crash a screen later.
 */

import { DEFAULT_RATES, DEFAULT_SETTINGS, SCHEMA_VERSION, createInitialData } from '../lib/defaults.ts';
import { isValidISODate } from '../lib/dates.ts';
import type {
  AppData,
  Budget,
  Category,
  Frequency,
  Goal,
  GoalContribution,
  RateTable,
  RecurringRule,
  Settings,
  TaxMode,
  ThemePreference,
  Transaction,
  TxKind,
} from '../types.ts';

const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];
const THEMES: ThemePreference[] = ['system', 'light', 'dark'];
const TAX_MODES: TaxMode[] = ['inclusive', 'exclusive'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Non-negative integer cents. Legacy float amounts are rounded, not rejected. */
function cents(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.round(value);
}

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function isoDate(value: unknown, fallback: string | null): string | null {
  return typeof value === 'string' && isValidISODate(value) ? value : fallback;
}

function parseCategory(raw: unknown): Category | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name).trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    icon: str(raw.icon, '🧾'),
    color: str(raw.color, '#94A3B8'),
    kind: oneOf<TxKind>(raw.kind, ['expense', 'income'], 'expense'),
    archived: bool(raw.archived),
  };
}

function parseTransaction(raw: unknown, knownCategories: Set<string>): Transaction | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const date = isoDate(raw.date, null);
  const categoryId = str(raw.categoryId);
  if (!id || !date || !knownCategories.has(categoryId)) return null;
  const amount = Math.abs(cents(raw.amount));
  const now = new Date().toISOString();
  return {
    id,
    amount,
    kind: oneOf<TxKind>(raw.kind, ['expense', 'income'], 'expense'),
    categoryId,
    date,
    note: str(raw.note),
    ...(parseOriginal(raw.original) ? { original: parseOriginal(raw.original)! } : {}),
    ...(typeof raw.taxAmount === 'number' && Number.isFinite(raw.taxAmount)
      ? { taxAmount: Math.max(0, Math.round(raw.taxAmount)) }
      : {}),
    // Only set the key when there is a link, so a round trip through JSON
    // gives back an object that deep-equals the original.
    ...(typeof raw.recurringId === 'string' ? { recurringId: raw.recurringId } : {}),
    createdAt: str(raw.createdAt, now),
    updatedAt: str(raw.updatedAt, now),
  };
}

/** The as-entered foreign amount, dropped entirely if any part is unusable. */
function parseOriginal(raw: unknown): { amount: number; currency: string; rate: number } | null {
  if (!isObject(raw)) return null;
  const currency = str(raw.currency).toUpperCase();
  const amount = cents(raw.amount, Number.NaN);
  const rate = typeof raw.rate === 'number' ? raw.rate : Number.NaN;
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) return null;
  return { amount: Math.abs(amount), currency, rate };
}

function parseBudget(raw: unknown, knownCategories: Set<string>): Budget | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const categoryId = str(raw.categoryId);
  if (!id || !knownCategories.has(categoryId)) return null;
  const month = typeof raw.month === 'string' && /^\d{4}-\d{2}$/.test(raw.month) ? raw.month : null;
  return { id, categoryId, amount: Math.max(0, cents(raw.amount)), month };
}

function parseRecurring(raw: unknown, knownCategories: Set<string>): RecurringRule | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const categoryId = str(raw.categoryId);
  const startDate = isoDate(raw.startDate, null);
  if (!id || !startDate || !knownCategories.has(categoryId)) return null;
  const reminder = cents(raw.reminderDaysBefore, 1);
  return {
    id,
    name: str(raw.name, 'Recurring'),
    amount: Math.abs(cents(raw.amount)),
    kind: oneOf<TxKind>(raw.kind, ['expense', 'income'], 'expense'),
    categoryId,
    frequency: oneOf<Frequency>(raw.frequency, FREQUENCIES, 'monthly'),
    startDate,
    endDate: isoDate(raw.endDate, null),
    lastPostedDate: isoDate(raw.lastPostedDate, null),
    autoPost: bool(raw.autoPost, true),
    reminderDaysBefore: Math.min(30, Math.max(0, reminder)),
    alarm: bool(raw.alarm, false),
    addToCalendar: bool(raw.addToCalendar, false),
    active: bool(raw.active, true),
  };
}

function parseContribution(raw: unknown): GoalContribution | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const date = isoDate(raw.date, null);
  if (!id || !date) return null;
  return { id, amount: cents(raw.amount), date, note: str(raw.note) };
}

function parseGoal(raw: unknown): Goal | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name).trim();
  if (!id || !name) return null;
  const contributions = Array.isArray(raw.contributions)
    ? raw.contributions.map(parseContribution).filter((c): c is GoalContribution => c !== null)
    : [];
  return {
    id,
    name,
    icon: str(raw.icon, '🎯'),
    color: str(raw.color, '#22C55E'),
    targetAmount: Math.max(0, cents(raw.targetAmount)),
    targetDate: isoDate(raw.targetDate, null),
    contributions,
    archived: bool(raw.archived),
  };
}

function parseSettings(raw: unknown): Settings {
  if (!isObject(raw)) return { ...DEFAULT_SETTINGS };
  const monthStartDay = cents(raw.monthStartDay, DEFAULT_SETTINGS.monthStartDay);
  const hour = cents(raw.reminderHour, DEFAULT_SETTINGS.reminderHour);
  const minute = cents(raw.reminderMinute, DEFAULT_SETTINGS.reminderMinute);
  const taxRate = typeof raw.taxRate === 'number' && Number.isFinite(raw.taxRate) ? raw.taxRate : 0;
  const country = str(raw.countryCode).toUpperCase();
  return {
    currency: str(raw.currency, DEFAULT_SETTINGS.currency).toUpperCase().slice(0, 3) || 'USD',
    locale: str(raw.locale, DEFAULT_SETTINGS.locale),
    theme: oneOf<ThemePreference>(raw.theme, THEMES, 'system'),
    countryCode: /^[A-Z]{2}$/.test(country) ? country : null,
    taxRate: Math.min(100, Math.max(0, taxRate)),
    taxLabel: str(raw.taxLabel, DEFAULT_SETTINGS.taxLabel) || 'Tax',
    taxMode: oneOf<TaxMode>(raw.taxMode, TAX_MODES, 'inclusive'),
    calendarEnabled: bool(raw.calendarEnabled, false),
    calendarId: typeof raw.calendarId === 'string' && raw.calendarId ? raw.calendarId : null,
    onlineRatesEnabled: bool(raw.onlineRatesEnabled, false),
    monthStartDay: Math.min(28, Math.max(1, monthStartDay)),
    remindersEnabled: bool(raw.remindersEnabled, DEFAULT_SETTINGS.remindersEnabled),
    reminderHour: Math.min(23, Math.max(0, hour)),
    reminderMinute: Math.min(59, Math.max(0, minute)),
    onboarded: bool(raw.onboarded),
  };
}

/** Exchange rates, with every unusable entry discarded. */
function parseRates(raw: unknown): RateTable {
  if (!isObject(raw)) return { ...DEFAULT_RATES, rates: { ...DEFAULT_RATES.rates } };
  const base = str(raw.base, 'USD').toUpperCase();
  const validBase = /^[A-Z]{3}$/.test(base) ? base : 'USD';
  const rates: Record<string, number> = { [validBase]: 1 };
  if (isObject(raw.rates)) {
    for (const [code, rate] of Object.entries(raw.rates)) {
      const upper = code.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(upper)) continue;
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) continue;
      rates[upper] = rate;
    }
  }
  return {
    base: validBase,
    rates,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
    source: raw.source === 'network' ? 'network' : 'manual',
  };
}

/** Validate and normalise a decoded blob into `AppData`. */
export function normalise(raw: unknown, makeId: () => string): AppData {
  if (!isObject(raw)) return createInitialData(makeId);

  const categories = Array.isArray(raw.categories)
    ? raw.categories.map(parseCategory).filter((c): c is Category => c !== null)
    : [];
  // A ledger with no categories cannot be rendered; fall back to a fresh start.
  if (categories.length === 0) {
    const fresh = createInitialData(makeId);
    return { ...fresh, rates: parseRates(raw.rates), settings: parseSettings(raw.settings) };
  }

  const ids = new Set(categories.map((c) => c.id));
  const transactions = Array.isArray(raw.transactions)
    ? raw.transactions.map((t) => parseTransaction(t, ids)).filter((t): t is Transaction => t !== null)
    : [];
  const budgets = Array.isArray(raw.budgets)
    ? raw.budgets.map((b) => parseBudget(b, ids)).filter((b): b is Budget => b !== null)
    : [];
  const recurring = Array.isArray(raw.recurring)
    ? raw.recurring.map((r) => parseRecurring(r, ids)).filter((r): r is RecurringRule => r !== null)
    : [];
  const goals = Array.isArray(raw.goals)
    ? raw.goals.map(parseGoal).filter((g): g is Goal => g !== null)
    : [];

  return {
    schemaVersion: SCHEMA_VERSION,
    categories,
    transactions,
    budgets,
    recurring,
    goals,
    rates: parseRates(raw.rates),
    settings: parseSettings(raw.settings),
  };
}

export function serialize(data: AppData): string {
  return JSON.stringify({ ...data, schemaVersion: SCHEMA_VERSION });
}

/** Decode stored JSON. Returns fresh data for anything unreadable. */
export function deserialize(text: string | null, makeId: () => string): AppData {
  if (!text) return createInitialData(makeId);
  try {
    return normalise(JSON.parse(text), makeId);
  } catch {
    return createInitialData(makeId);
  }
}

export type BackupFile = {
  app: 'pocketbook';
  schemaVersion: number;
  exportedAt: string;
  data: AppData;
};

export function createBackup(data: AppData): string {
  const payload: BackupFile = {
    app: 'pocketbook',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  return JSON.stringify(payload, null, 2);
}

export type RestoreResult =
  | { ok: true; data: AppData }
  | { ok: false; error: string };

/** Read a backup file's contents. Accepts both wrapped and bare app data. */
export function readBackup(text: string, makeId: () => string): RestoreResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (!isObject(parsed)) return { ok: false, error: "That file doesn't look like a backup." };
  const body = isObject(parsed.data) ? parsed.data : parsed;
  if (!Array.isArray((body as Record<string, unknown>).categories)) {
    return { ok: false, error: 'No categories found — this is not a Pocketbook backup.' };
  }
  return { ok: true, data: normalise(body, makeId) };
}

/** Transactions as CSV, for opening in a spreadsheet. */
export function toCSV(data: AppData): string {
  const names = new Map(data.categories.map((c) => [c.id, c.name]));
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = ['Date,Type,Category,Note,Amount'];
  const rows = [...data.transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const t of rows) {
    const amount = (t.kind === 'expense' ? -t.amount : t.amount) / 100;
    lines.push(
      [
        t.date,
        t.kind,
        escape(names.get(t.categoryId) ?? 'Unknown'),
        escape(t.note),
        amount.toFixed(2),
      ].join(',')
    );
  }
  return lines.join('\n');
}
