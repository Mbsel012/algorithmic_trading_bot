/**
 * App-wide state: one reducer, one AsyncStorage-backed copy of the ledger, and
 * a few selectors screens lean on. No network calls happen anywhere in here.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { AppState, useColorScheme } from 'react-native';

import { convert as convertMoney } from '../lib/currency.ts';
import { createInitialData } from '../lib/defaults.ts';
import { periodFor, today, type Period } from '../lib/dates.ts';
import { createId } from '../lib/id.ts';
import { formatMoney } from '../lib/money.ts';
import { flushSave, loadData, scheduleSave } from '../storage/repository.ts';
import { makeTheme, type Theme } from '../theme/index.ts';
import type { AppData, Category, Settings } from '../types.ts';
import { reducer, sortedTransactions, type Action } from './reducer.ts';

type Ctx = {
  data: AppData;
  ready: boolean;
  dispatch: React.Dispatch<Action>;
  theme: Theme;
  /** Format cents with the user's currency and locale. */
  money: (cents: number, options?: { signed?: boolean; compact?: boolean }) => string;
  categoryById: (id: string) => Category | undefined;
  /**
   * Convert into the user's home currency. Returns null when no rate links the
   * two, so callers show "no rate" rather than a silently wrong number.
   */
  toHomeCurrency: (amount: number, from: string) => number | null;
  /** The budget period containing today, honouring the month-start setting. */
  currentPeriod: Period;
  updateSettings: (patch: Partial<Settings>) => void;
};

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, dispatch] = useReducer(reducer, null, () => createInitialData(() => createId('cat')));
  const [ready, setReady] = useState(false);
  const systemScheme = useColorScheme();
  const hydrated = useRef(false);

  // Load once on mount, then let every later change persist itself.
  useEffect(() => {
    let cancelled = false;
    loadData()
      .then((stored) => {
        if (cancelled) return;
        dispatch({ type: 'hydrate', data: stored });
      })
      .catch(() => {
        // A failed read is not fatal: the seeded state is already in place.
      })
      .finally(() => {
        if (cancelled) return;
        hydrated.current = true;
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    scheduleSave(data);
  }, [data]);

  // Don't lose the last few edits when the app goes to the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void flushSave();
    });
    return () => sub.remove();
  }, []);

  // Catch up on any recurring bills that came due while the app was closed.
  useEffect(() => {
    if (!ready) return;
    dispatch({
      type: 'recurring/runAutoPost',
      asOf: today(),
      makeId: () => createId('tx'),
      now: new Date().toISOString(),
    });
  }, [ready]);

  const { settings } = data;
  const isDark = settings.theme === 'system' ? systemScheme === 'dark' : settings.theme === 'dark';
  const theme = useMemo(() => makeTheme(isDark), [isDark]);

  const money = useCallback(
    (cents: number, options?: { signed?: boolean; compact?: boolean }) =>
      formatMoney(cents, settings.currency, settings.locale, options),
    [settings.currency, settings.locale]
  );

  const categoryIndex = useMemo(
    () => new Map(data.categories.map((c) => [c.id, c])),
    [data.categories]
  );
  const categoryById = useCallback((id: string) => categoryIndex.get(id), [categoryIndex]);

  const toHomeCurrency = useCallback(
    (amount: number, from: string) =>
      from.toUpperCase() === settings.currency
        ? amount
        : convertMoney(amount, from, settings.currency, data.rates),
    [settings.currency, data.rates]
  );

  const currentPeriod = useMemo(
    () => periodFor(today(), settings.monthStartDay, settings.locale),
    [settings.monthStartDay, settings.locale]
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => dispatch({ type: 'settings/update', patch }),
    []
  );

  const value = useMemo<Ctx>(
    () => ({
      data,
      ready,
      dispatch,
      theme,
      money,
      categoryById,
      toHomeCurrency,
      currentPeriod,
      updateSettings,
    }),
    [data, ready, theme, money, categoryById, toHomeCurrency, currentPeriod, updateSettings]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export function useTheme(): Theme {
  return useApp().theme;
}

/** All transactions, newest first. */
export function useTransactions() {
  const { data } = useApp();
  return useMemo(() => sortedTransactions(data.transactions), [data.transactions]);
}

export function useCategories(kind?: 'expense' | 'income', includeArchived = false) {
  const { data } = useApp();
  return useMemo(
    () =>
      data.categories
        .filter((c) => (kind ? c.kind === kind : true))
        .filter((c) => (includeArchived ? true : !c.archived))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.categories, kind, includeArchived]
  );
}
