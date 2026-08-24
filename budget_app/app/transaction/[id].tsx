import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { today, type ISODate } from '../../src/lib/dates.ts';
import { createId } from '../../src/lib/id.ts';
import { parseAmount, toDecimalString } from '../../src/lib/money.ts';
import {
  AmountField,
  CategoryPicker,
  DateField,
  Field,
  TextField,
} from '../../src/components/fields.tsx';
import { Body, Button, Row, Screen, Segmented, Spacer, Txt } from '../../src/components/ui.tsx';
import { useApp, useCategories } from '../../src/state/store.tsx';
import { spacing } from '../../src/theme/index.ts';
import type { TxKind } from '../../src/types.ts';

export default function TransactionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, dispatch } = useApp();

  const existing = useMemo(
    () => (id === 'new' ? undefined : data.transactions.find((t) => t.id === id)),
    [id, data.transactions]
  );

  const [kind, setKind] = useState<TxKind>(existing?.kind ?? 'expense');
  const [amount, setAmount] = useState(
    existing ? toDecimalString(existing.amount, data.settings.currency) : ''
  );
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [date, setDate] = useState<ISODate>(existing?.date ?? today());
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const categories = useCategories(kind);

  // Keep a sensible category selected when the user flips expense/income.
  const effectiveCategoryId = useMemo(() => {
    if (categoryId && categories.some((c) => c.id === categoryId)) return categoryId;
    return categories[0]?.id ?? null;
  }, [categoryId, categories]);

  function save() {
    const cents = parseAmount(amount);
    if (cents === null || cents <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!effectiveCategoryId) {
      setError('Pick a category first.');
      return;
    }
    const now = new Date().toISOString();
    if (existing) {
      dispatch({
        type: 'transaction/update',
        transaction: {
          ...existing,
          amount: cents,
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
          amount: cents,
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
          />
        </Field>

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
    </Screen>
  );
}
