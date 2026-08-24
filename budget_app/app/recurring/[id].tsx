import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { formatDateLabel, today, type ISODate } from '../../src/lib/dates.ts';
import { createId } from '../../src/lib/id.ts';
import { parseAmount, toDecimalString } from '../../src/lib/money.ts';
import { FREQUENCY_LABELS, nextDueDate } from '../../src/lib/recurring.ts';
import {
  AmountField,
  CategoryPicker,
  DateField,
  Field,
  TextField,
} from '../../src/components/fields.tsx';
import { Body, Button, Card, Chip, Row, Screen, Segmented, Spacer, Txt } from '../../src/components/ui.tsx';
import { useApp, useCategories } from '../../src/state/store.tsx';
import { spacing } from '../../src/theme/index.ts';
import type { Frequency, TxKind } from '../../src/types.ts';

const REMINDER_CHOICES = [
  { value: 0, label: 'None' },
  { value: 1, label: '1 day before' },
  { value: 2, label: '2 days' },
  { value: 3, label: '3 days' },
  { value: 7, label: 'A week' },
];

export default function RecurringEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, dispatch, money, theme } = useApp();
  const now = today();

  const existing = useMemo(() => data.recurring.find((r) => r.id === id), [data.recurring, id]);
  const isNew = id === 'new';

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<TxKind>(existing?.kind ?? 'expense');
  const [amount, setAmount] = useState(
    existing ? toDecimalString(existing.amount, data.settings.currency) : ''
  );
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly');
  const [startDate, setStartDate] = useState<ISODate>(existing?.startDate ?? now);
  const [endDate, setEndDate] = useState<ISODate | null>(existing?.endDate ?? null);
  const [autoPost, setAutoPost] = useState(existing?.autoPost ?? true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(existing?.reminderDaysBefore ?? 1);
  const [active, setActive] = useState(existing?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const categories = useCategories(kind);
  const effectiveCategoryId = useMemo(() => {
    if (categoryId && categories.some((c) => c.id === categoryId)) return categoryId;
    return categories[0]?.id ?? null;
  }, [categoryId, categories]);

  function save() {
    const cents = parseAmount(amount);
    if (!name.trim()) {
      setError('Give it a name, like "Rent" or "Salary".');
      return;
    }
    if (cents === null || cents <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!effectiveCategoryId) {
      setError('Pick a category first.');
      return;
    }
    if (endDate && endDate < startDate) {
      setError('The end date is before the start date.');
      return;
    }

    const rule = {
      id: existing?.id ?? createId('rec'),
      name: name.trim(),
      amount: cents,
      kind,
      categoryId: effectiveCategoryId,
      frequency,
      startDate,
      endDate,
      // Changing the start date restarts the series, so drop the old marker.
      lastPostedDate: existing && existing.startDate === startDate ? existing.lastPostedDate : null,
      autoPost,
      reminderDaysBefore,
      active,
    };

    dispatch(existing ? { type: 'recurring/update', rule } : { type: 'recurring/add', rule });
    router.back();
  }

  function remove() {
    if (!existing) return;
    Alert.alert('Delete this rule?', 'Transactions it already added will stay in your ledger.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          dispatch({ type: 'recurring/delete', id: existing.id });
          router.back();
        },
      },
    ]);
  }

  const preview = existing ? nextDueDate(existing, now) : null;

  return (
    <Screen edges={['bottom']}>
      <Body>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Bill / expense' },
            { value: 'income', label: 'Income' },
          ]}
        />
        <Spacer />

        <Field label="Name" error={error ?? undefined}>
          <TextField value={name} onChangeText={setName} placeholder="Rent" autoFocus={isNew} />
        </Field>

        <Field label="Amount">
          <AmountField value={amount} onChangeText={setAmount} tone={kind === 'income' ? 'positive' : undefined} />
        </Field>

        <Field label="Category">
          <CategoryPicker categories={categories} value={effectiveCategoryId} onChange={setCategoryId} />
        </Field>

        <Field label="How often">
          <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
            {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((option) => (
              <Chip
                key={option}
                label={FREQUENCY_LABELS[option]}
                selected={frequency === option}
                onPress={() => setFrequency(option)}
              />
            ))}
          </Row>
        </Field>

        <Field label="First date" hint="Monthly bills keep this day of the month.">
          <DateField value={startDate} onChange={(next) => setStartDate(next ?? now)} />
        </Field>

        <Field label="Stop after" hint="Optional — leave empty to repeat indefinitely.">
          <DateField value={endDate} onChange={setEndDate} allowClear placeholder="Never ends" />
        </Field>

        <Card style={{ marginBottom: spacing.lg }}>
          <Row justify="space-between">
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Txt variant="body">Add it automatically</Txt>
              <Txt variant="caption" tone="faint">
                When off, it waits for you to confirm each time.
              </Txt>
            </View>
            <Switch
              value={autoPost}
              onValueChange={setAutoPost}
              trackColor={{ true: theme.colors.primary, false: theme.colors.track }}
            />
          </Row>
          <Spacer size={spacing.md} />
          <Row justify="space-between">
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Txt variant="body">Active</Txt>
              <Txt variant="caption" tone="faint">
                Pause it without losing the history.
              </Txt>
            </View>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ true: theme.colors.primary, false: theme.colors.track }}
            />
          </Row>
        </Card>

        <Field label="Remind me" hint="A local notification on this device only.">
          <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
            {REMINDER_CHOICES.map((choice) => (
              <Chip
                key={choice.value}
                label={choice.label}
                selected={reminderDaysBefore === choice.value}
                onPress={() => setReminderDaysBefore(choice.value)}
              />
            ))}
          </Row>
        </Field>

        {existing && preview ? (
          <Txt variant="caption" tone="faint" style={{ marginBottom: spacing.lg }}>
            Next one lands {formatDateLabel(preview, data.settings.locale)} for {money(existing.amount)}.
          </Txt>
        ) : null}

        <Button label={existing ? 'Save changes' : 'Add recurring item'} onPress={save} />

        {existing ? (
          <>
            <Spacer />
            <Button label="Delete rule" variant="danger" onPress={remove} />
          </>
        ) : null}
      </Body>
    </Screen>
  );
}
