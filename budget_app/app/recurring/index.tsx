import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { formatRelativeDay, today } from '../../src/lib/dates.ts';
import { createId } from '../../src/lib/id.ts';
import {
  FREQUENCY_LABELS,
  buildTransaction,
  dueOccurrences,
  monthlyEquivalent,
  nextDueDate,
} from '../../src/lib/recurring.ts';
import {
  Body,
  Button,
  Card,
  Divider,
  EmptyState,
  ListItem,
  Row,
  Screen,
  Spacer,
  StatTile,
  Txt,
} from '../../src/components/ui.tsx';
import { useApp } from '../../src/state/store.tsx';
import { spacing } from '../../src/theme/index.ts';

export default function RecurringScreen() {
  const router = useRouter();
  const { data, money, dispatch } = useApp();
  const now = today();

  const rules = useMemo(
    () =>
      [...data.recurring].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        const nextA = nextDueDate(a, now) ?? '9999-12-31';
        const nextB = nextDueDate(b, now) ?? '9999-12-31';
        return nextA.localeCompare(nextB);
      }),
    [data.recurring, now]
  );

  const monthlyOut = rules
    .filter((r) => r.active && r.kind === 'expense')
    .reduce((acc, r) => acc + monthlyEquivalent(r), 0);
  const monthlyIn = rules
    .filter((r) => r.active && r.kind === 'income')
    .reduce((acc, r) => acc + monthlyEquivalent(r), 0);

  // Manual rules that have already come due, including ones missed while the
  // app was closed. Auto-posting rules never land here — they post themselves.
  const dueNow = useMemo(
    () =>
      data.recurring
        .filter((rule) => rule.active && !rule.autoPost)
        .flatMap((rule) => dueOccurrences(rule, now).map((date) => ({ rule, date })))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [data.recurring, now]
  );

  return (
    <Screen edges={['bottom']}>
      <Body>
        {rules.length === 0 ? (
          <Card>
            <EmptyState
              icon="🔁"
              title="No recurring items"
              message="Add rent, salary, subscriptions or any bill that repeats, and the app will keep the ledger up to date for you."
              actionLabel="Add a recurring item"
              onAction={() => router.push('/recurring/new')}
            />
          </Card>
        ) : (
          <>
            <Card>
              <Row>
                <StatTile label="Recurring in" value={money(monthlyIn)} tone="positive" caption="per month" />
                <StatTile label="Recurring out" value={money(monthlyOut)} tone="negative" caption="per month" />
                <StatTile
                  label="Net"
                  value={money(monthlyIn - monthlyOut, { signed: true })}
                  tone={monthlyIn - monthlyOut >= 0 ? 'positive' : 'negative'}
                  caption="per month"
                />
              </Row>
            </Card>
            <Spacer />

            {dueNow.length > 0 ? (
              <>
                <Txt variant="heading" style={{ marginBottom: spacing.sm }}>
                  Waiting for you
                </Txt>
                <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
                  {dueNow.map((item, index) => (
                    <View key={`${item.rule.id}-${item.date}`}>
                      {index > 0 ? <Divider /> : null}
                      <ListItem
                        icon="⏰"
                        title={item.rule.name}
                        subtitle={`Due ${formatRelativeDay(item.date, now, data.settings.locale).toLowerCase()}`}
                        right={<Txt variant="label">{money(item.rule.amount)}</Txt>}
                        rightSub={
                          <Row gap={spacing.md} style={{ marginTop: 4 }}>
                            <Txt
                              variant="caption"
                              tone="muted"
                              onPress={() =>
                                dispatch({ type: 'recurring/skip', ruleId: item.rule.id, date: item.date })
                              }
                            >
                              Skip
                            </Txt>
                            <Txt
                              variant="caption"
                              tone="primary"
                              onPress={() =>
                                dispatch({
                                  type: 'recurring/post',
                                  ruleId: item.rule.id,
                                  date: item.date,
                                  transaction: buildTransaction(item.rule, item.date, createId('tx')),
                                })
                              }
                            >
                              Record
                            </Txt>
                          </Row>
                        }
                      />
                    </View>
                  ))}
                </Card>
                <Spacer />
              </>
            ) : null}

            <Txt variant="heading" style={{ marginBottom: spacing.sm }}>
              All rules
            </Txt>
            <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
              {rules.map((rule, index) => {
                const next = nextDueDate(rule, now);
                const category = data.categories.find((c) => c.id === rule.categoryId);
                return (
                  <View key={rule.id}>
                    {index > 0 ? <Divider /> : null}
                    <ListItem
                      icon={category?.icon ?? '🔁'}
                      iconColor={category?.color}
                      title={rule.name}
                      subtitle={
                        rule.active
                          ? `${FREQUENCY_LABELS[rule.frequency]} · ${
                              next ? `next ${formatRelativeDay(next, now, data.settings.locale).toLowerCase()}` : 'finished'
                            }`
                          : 'Paused'
                      }
                      right={
                        <Txt variant="label" tone={rule.kind === 'income' ? 'positive' : 'default'}>
                          {rule.kind === 'income' ? '+' : '−'}
                          {money(rule.amount)}
                        </Txt>
                      }
                      onPress={() => router.push(`/recurring/${rule.id}`)}
                    />
                  </View>
                );
              })}
            </Card>
          </>
        )}

        <Spacer />
        <Button label="Add recurring item" onPress={() => router.push('/recurring/new')} />
      </Body>
    </Screen>
  );
}
