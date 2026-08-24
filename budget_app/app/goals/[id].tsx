import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { formatDateLabel, today, type ISODate } from '../../src/lib/dates.ts';
import { CATEGORY_COLORS } from '../../src/lib/defaults.ts';
import { goalProgress } from '../../src/lib/goals.ts';
import { createId } from '../../src/lib/id.ts';
import { parseAmount, toDecimalString } from '../../src/lib/money.ts';
import {
  AmountField,
  ColorPicker,
  DateField,
  Field,
  IconPicker,
  TextField,
} from '../../src/components/fields.tsx';
import {
  Body,
  Button,
  Card,
  Divider,
  ListItem,
  ProgressBar,
  Row,
  Screen,
  Sheet,
  Spacer,
  StatTile,
  Txt,
} from '../../src/components/ui.tsx';
import { useApp } from '../../src/state/store.tsx';
import { spacing } from '../../src/theme/index.ts';

export default function GoalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, money, dispatch } = useApp();
  const now = today();

  const existing = useMemo(() => data.goals.find((g) => g.id === id), [data.goals, id]);
  const isNew = id === 'new';

  const [name, setName] = useState(existing?.name ?? '');
  const [target, setTarget] = useState(
    existing ? toDecimalString(existing.targetAmount, data.settings.currency) : ''
  );
  const [targetDate, setTargetDate] = useState<ISODate | null>(existing?.targetDate ?? null);
  const [icon, setIcon] = useState(existing?.icon ?? '🎯');
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const [contributing, setContributing] = useState(false);
  const [contribution, setContribution] = useState('');
  const [contributionDate, setContributionDate] = useState<ISODate>(now);

  const progress = existing ? goalProgress(existing, now) : null;

  function save() {
    const amount = parseAmount(target);
    if (!name.trim()) {
      setError('Give the goal a name.');
      return;
    }
    if (amount === null || amount <= 0) {
      setError('Set a target amount greater than zero.');
      return;
    }
    if (existing) {
      dispatch({
        type: 'goal/update',
        goal: { ...existing, name: name.trim(), targetAmount: amount, targetDate, icon, color },
      });
    } else {
      dispatch({
        type: 'goal/add',
        goal: {
          id: createId('goal'),
          name: name.trim(),
          icon,
          color,
          targetAmount: amount,
          targetDate,
          contributions: [],
          archived: false,
        },
      });
    }
    router.back();
  }

  function addContribution() {
    if (!existing) return;
    const amount = parseAmount(contribution);
    if (amount === null || amount === 0) return;
    dispatch({
      type: 'goal/contribute',
      goalId: existing.id,
      contribution: { id: createId('con'), amount, date: contributionDate, note: '' },
    });
    setContribution('');
    setContributing(false);
  }

  function remove() {
    if (!existing) return;
    Alert.alert('Delete this goal?', 'Its contribution history goes with it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          dispatch({ type: 'goal/delete', id: existing.id });
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen edges={['bottom']}>
      <Body>
        {existing && progress ? (
          <>
            <Card>
              <Row justify="space-between">
                <Txt variant="heading">
                  {existing.icon} {existing.name}
                </Txt>
                <Txt variant="label" tone={progress.complete ? 'positive' : 'muted'}>
                  {Math.round(progress.progress * 100)}%
                </Txt>
              </Row>
              <Spacer size={spacing.md} />
              <ProgressBar progress={progress.progress} color={existing.color} height={10} />
              <Spacer size={spacing.md} />
              <Row>
                <StatTile label="Saved" value={money(progress.saved)} tone="positive" />
                <StatTile label="To go" value={money(progress.remaining)} />
                <StatTile
                  label="Per month"
                  value={progress.requiredPerMonth !== null ? money(progress.requiredPerMonth) : '—'}
                  caption={
                    existing.targetDate
                      ? formatDateLabel(existing.targetDate, data.settings.locale)
                      : 'no deadline'
                  }
                />
              </Row>
            </Card>
            <Spacer />
            <Button label="Add money to this goal" onPress={() => setContributing(true)} />
            <Spacer />
          </>
        ) : null}

        <Card>
          <Field label="Name" error={error ?? undefined}>
            <TextField value={name} onChangeText={setName} placeholder="Emergency fund" autoFocus={isNew} />
          </Field>
          <Field label="Target amount">
            <AmountField value={target} onChangeText={setTarget} />
          </Field>
          <Field label="Target date" hint="Optional — used to work out the monthly amount.">
            <DateField value={targetDate} onChange={setTargetDate} allowClear placeholder="No deadline" />
          </Field>
          <Field label="Icon">
            <IconPicker value={icon} onChange={setIcon} />
          </Field>
          <Field label="Colour">
            <ColorPicker value={color} onChange={setColor} />
          </Field>
          <Button label={existing ? 'Save changes' : 'Create goal'} onPress={save} />
        </Card>

        {existing && existing.contributions.length > 0 ? (
          <>
            <Spacer />
            <Txt variant="heading" style={{ marginBottom: spacing.sm }}>
              History
            </Txt>
            <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
              {existing.contributions.map((entry, index) => (
                <View key={entry.id}>
                  {index > 0 ? <Divider /> : null}
                  <ListItem
                    icon={entry.amount >= 0 ? '➕' : '➖'}
                    title={money(Math.abs(entry.amount))}
                    subtitle={formatDateLabel(entry.date, data.settings.locale)}
                    right={
                      <Txt
                        variant="caption"
                        tone="negative"
                        onPress={() =>
                          dispatch({
                            type: 'goal/removeContribution',
                            goalId: existing.id,
                            contributionId: entry.id,
                          })
                        }
                      >
                        Remove
                      </Txt>
                    }
                  />
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {existing ? (
          <>
            <Spacer size={spacing.xl} />
            <Button label="Delete goal" variant="danger" onPress={remove} />
          </>
        ) : null}
      </Body>

      <Sheet visible={contributing} onClose={() => setContributing(false)} title="Add to goal">
        <Field label="Amount" hint="Use a minus sign to record a withdrawal.">
          <AmountField value={contribution} onChangeText={setContribution} autoFocus tone="positive" />
        </Field>
        <Field label="Date">
          <DateField value={contributionDate} onChange={(next) => setContributionDate(next ?? now)} />
        </Field>
        <Button label="Add" onPress={addContribution} />
      </Sheet>
    </Screen>
  );
}
