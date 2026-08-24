/** Seed data used the first time the app launches. */

import type { AppData, Category, Settings } from '../types.ts';

export const SCHEMA_VERSION = 1;

/**
 * Categorical palette for charts and chips, in fixed assignment order.
 *
 * Every step sits inside the light *and* dark lightness bands and clears the
 * colour-vision-deficiency separation floor for adjacent pairs, so one set of
 * hues works in both themes. Re-validate before changing any value.
 */
export const CATEGORY_COLORS = [
  '#16A34A', '#0284C7', '#EA580C', '#9333EA', '#E11D48', '#C08A0A',
  '#0D9488', '#6366F1', '#DB2777', '#65A30D', '#0891B2', '#B45309',
];

/** Neutral used for "Other" and for rows whose category has been removed. */
export const NEUTRAL_COLOR = '#64748B';

export const CATEGORY_ICONS = [
  '🛒', '🍽️', '🚌', '🏠', '💡', '📱', '🎬', '👕', '💊', '🎓', '✈️', '🎁',
  '☕', '⛽', '🐾', '🏋️', '💼', '💰', '📈', '🧾', '🚗', '🧴', '🍺', '🎵',
];

type Seed = Omit<Category, 'id'>;

/** Everyday categories, chosen to cover a normal household without clutter. */
export const DEFAULT_CATEGORY_SEEDS: Seed[] = [
  { name: 'Groceries', icon: '🛒', color: '#16A34A', kind: 'expense', archived: false },
  { name: 'Eating out', icon: '🍽️', color: '#EA580C', kind: 'expense', archived: false },
  { name: 'Rent', icon: '🏠', color: '#6366F1', kind: 'expense', archived: false },
  { name: 'Utilities', icon: '💡', color: '#C08A0A', kind: 'expense', archived: false },
  { name: 'Transport', icon: '🚌', color: '#0284C7', kind: 'expense', archived: false },
  { name: 'Phone & internet', icon: '📱', color: '#0D9488', kind: 'expense', archived: false },
  { name: 'Health', icon: '💊', color: '#E11D48', kind: 'expense', archived: false },
  { name: 'Shopping', icon: '👕', color: '#9333EA', kind: 'expense', archived: false },
  { name: 'Entertainment', icon: '🎬', color: '#DB2777', kind: 'expense', archived: false },
  { name: 'Other', icon: '🧾', color: '#64748B', kind: 'expense', archived: false },
  { name: 'Salary', icon: '💼', color: '#16A34A', kind: 'income', archived: false },
  { name: 'Side income', icon: '📈', color: '#0891B2', kind: 'income', archived: false },
  { name: 'Gifts', icon: '🎁', color: '#9333EA', kind: 'income', archived: false },
];

export const DEFAULT_SETTINGS: Settings = {
  currency: 'USD',
  locale: 'en-US',
  theme: 'system',
  monthStartDay: 1,
  remindersEnabled: true,
  reminderHour: 9,
  reminderMinute: 0,
  onboarded: false,
};

export function createInitialData(makeId: () => string): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    categories: DEFAULT_CATEGORY_SEEDS.map((seed) => ({ ...seed, id: makeId() })),
    transactions: [],
    budgets: [],
    recurring: [],
    goals: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** A short list of currencies for the settings picker; free text is also allowed. */
export const COMMON_CURRENCIES = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'NGN', label: 'Nigerian Naira' },
  { code: 'ETB', label: 'Ethiopian Birr' },
  { code: 'KES', label: 'Kenyan Shilling' },
  { code: 'ZAR', label: 'South African Rand' },
  { code: 'AED', label: 'UAE Dirham' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'BRL', label: 'Brazilian Real' },
  { code: 'MXN', label: 'Mexican Peso' },
];
