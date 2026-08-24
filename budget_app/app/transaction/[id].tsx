import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { availableCurrencies, crossRate } from '../../src/lib/currency.ts';
import { today, type ISODate } from '../../src/lib/dates.ts';
import { createId } from '../../src/lib/id.ts';
import { formatMoney, parseAmount, toDecimalString } from '../../src/lib/money.ts';
import { formatRate, split } from '../../src/lib/tax.ts';
import {
  AmountField,
  CategoryPicker,
  DateField,
  Field,
  TextField,
} from '../../src/components/fields.tsx';
import { Body, Button, Card, Chip, Row, Screen, Segmented, Sheet, Spacer, Txt } from '../../src/components/ui.tsx';
import { Switch } from 'react-native';

import { useApp, useCategories } from '../../src/state/store.tsx';
import { spacing } from '../../src/theme/index.ts';
import type { TxKind } from '../../src/types.ts';

export default function TransactionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, dispatch, theme, toHomeCurrency } = useApp();
  const home = data.settings.currency;

  const existing = useMemo(
    () => (id === 'new' ? undefined : data.transactions.find((t) => t.id === id)),
    [id, data.transactions]
  );

  const [kind, setKind] = useState<TxKind>(existing?.kind ?? 'expense');
  const [amount, setAmount] = useState(() => {
    if (!existing) return '';
    // Show what was actually typed, in the currency it was typed in.
    return existing.original
      ? toDecimalString(existing.original.amount, existing.original.currency)
      : toDecimalString(existing.amount, data.settings.currency);
  });
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [date, setDate] = useState<ISODate>(existing?.date ?? today());
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  // Entry currency: what the user is typing in, which may not be home.
  const [entryCurrency, setEntryCurrency] = useState(existing?.original?.currency ?? home);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [recordTax, setRecordTax] = useState(existing?.taxAmount !== undefined);

  const categories = useCategories(kind);

  const currencyOptions = useMemo(() => {
    const set = new Set([home, ...availableCurrencies(data.rates)]);
    return [...set].sort();
  }, [home, data.rates]);

  const entered = parseAmount(amount, entryCurrency);
  const isForeign = entryCurrency !== home;
  const homeAmount = entered === null ? null : isForeign ? toHomeCurrency(entered, entryCurrency) : entered;
  const taxSplit =
    homeAmount !== null && data.settings.taxRate > 0
      ? split(homeAmount, data.settings.taxRate, data.settings.taxMode)
      : null;

  // Keep a sensible category selected when the user flips expense/income.
  const effectiveCategoryId = useMemo(() => {
    if (categoryId && categories.some((c) => c.id === categoryId)) return categoryId;
    return categories[0]?.id ?? null;
  }, [categoryId, categories]);

  function save() {
    const cents = entered;
    if (cents === null || cents <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!effectiveCategoryId) {
      setError('Pick a category first.');
      return;
    }
    if (isForeign && homeAmount === null) {
      setError(`No rate from ${entryCurrency} to ${home} — add one in the converter.`);
      return;
    }
    const now = new Date().toISOString();
    // The stored amount is always in the home currency so every total adds up;
    // the as-entered figure is kept alongside it.
    const storedAmount = homeAmount ?? cents;
    const rate = isForeign ? crossRate(entryCurrency, home, data.rates) ?? 1 : 1;
    const extras = {
      ...(isForeign ? { original: { amount: cents, currency: entryCurrency, rate } } : {}),
      ...(recordTax && taxSplit ? { taxAmount: taxSplit.tax } : {}),
    };
    if (existing) {
      dispatch({
        type: 'transaction/update',
        transaction: {
          ...existing,
          original: undefined,
          taxAmount: undefined,
          ...extras,
          amount: storedAmount,
          kind,
          categoryId: effectiveCategoryId,
          date,
          note: note.trim(),
          updatedAt: now,
        },
      });
    } else {
      dispatch({
        type: 'transaction/add',
        transaction: {
          id: createId('tx'),
          ...extras,
          amount: storedAmount,
          kind,
          categoryId: effectiveCategoryId,
          date,
          note: note.trim(),
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    router.back();
  }

  function remove() {
    if (!existing) return;
    Alert.alert('Delete this transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          dispatch({ type: 'transaction/delete', id: existing.id });
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen edges={['bottom']}>
      <Body>
        <Segmented
          value={kind}
          onChange={(next) => {
            setKind(next);
            setError(null);
          }}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />
        <Spacer />

        <Field label="Amount" error={error ?? undefined}>
          <AmountField
            value={amount}
            onChangeText={(next) => {
              setAmount(next);
              setError(null);
            }}
            autoFocus={!existing}
            tone={kind === 'income' ? 'positive' : undefined}
            currency={entryCurrency}
            onPressCurrency={currencyOptions.length > 1 ? () => setCurrencyOpen(true) : undefined}
          />
          {isForeign ? (
            <Txt variant="caption" tone={homeAmount === null ? 'negative' : 'muted'} style={{ marginTop: 6 }}>
              {homeAmount === null
                ? `No ${entryCurrency}→${home} rate yet. Add one in More › Converter.`
                : `Saved as ${formatMoney(homeAmount, home, data.settings.locale)} at 1 ${entryCurrency} = ${(
                    crossRate(entryCurrency, home, data.rates) ?? 0
                  )
                    .toPrecision(6)
                    .replace(/\.?0+$/, '')} ${home}`}
            </Txt>
          ) : null}
        </Field>

        {data.settings.taxRate > 0 && taxSplit ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <Row justify="space-between">
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Txt variant="body">
                  Record {data.settings.taxLabel} ({formatRate(data.settings.taxRate)})
                </Txt>
                <Txt variant="caption" tone="faint">
                  {data.settings.taxMode === 'inclusive'
                    ? `Of ${formatMoney(taxSplit.gross, home, data.settings.locale)}, about ${formatMoney(
                        taxSplit.tax,
                        home,
                        data.settings.locale
                      )} is ${data.settings.taxLabel}.`
                    : `Adds ${formatMoney(taxSplit.tax, home, data.settings.locale)} — ${formatMoney(
                        taxSplit.gross,
                        home,
                        data.settings.locale
                      )} in total.`}
                </Txt>
              </View>
              <Switch
                value={recordTax}
                onValueChange={setRecordTax}
                trackColor={{ true: theme.colors.primary, false: theme.colors.track }}
              />
            </Row>
          </Card>
        ) : null}

        <Field label="Category">
          {categories.length === 0 ? (
            <Txt tone="muted">Add a {kind} category first in More › Categories.</Txt>
          ) : (
            <CategoryPicker
              categories={categories}
              value={effectiveCategoryId}
              onChange={(next) => {
                setCategoryId(next);
                setError(null);
              }}
            />
          )}
        </Field>

        <Field label="Date">
          <DateField value={date} onChange={(next) => setDate(next ?? today())} />
        </Field>

        <Field label="Note" hint="Optional — what was it for?">
          <TextField value={note} onChangeText={setNote} placeholder="e.g. Weekly shop" maxLength={120} />
        </Field>

        {existing?.recurringId ? (
          <Txt variant="caption" tone="faint">
            This one was added by a recurring rule. Editing it here won't change the rule.
          </Txt>
        ) : null}

        <Spacer />
        <Row gap={spacing.md}>
          {existing ? (
            <View style={{ flex: 1 }}>
              <Button label="Delete" variant="danger" onPress={remove} />
            </View>
          ) : null}
          <View style={{ flex: 2 }}>
            <Button label={existing ? 'Save changes' : 'Add transaction'} onPress={save} />
          </View>
        </Row>
      </Body>

      <Sheet visible={currencyOpen} onClose={() => setCurrencyOpen(false)} title="Entered in">
        <Txt variant="caption" tone="muted" style={{ marginBottom: spacing.md }}>
          Pick the currency you actually paid in. The transaction is stored in
          {' '}{home} so your totals still add up.
        </Txt>
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          {currencyOptions.map((code) => (
            <Chip
              key={code}
              label={code}
              selected={code === entryCurrency}
              onPress={() => {
                setEntryCurrency(code);
                setCurrencyOpen(false);
                setError(null);
              }}
            />
          ))}
        </Row>
      </Sheet>
    </Screen>
  );
}
