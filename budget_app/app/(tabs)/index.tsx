import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { budgetStatuses, pace, summarise } from '../../src/lib/budget.ts';
import { formatRelativeDay, today } from '../../src/lib/dates.ts';
import { summariseGoals } from '../../src/lib/goals.ts';
import { createId } from '../../src/lib/id.ts';
import { buildTransaction, upcoming } from '../../src/lib/recurring.ts';
import {
  Body,
  Button,
  Card,
  Divider,
  EmptyState,
  Fab,
  ListItem,
  ProgressBar,
  Row,
  Screen,
  SectionHeader,
  Spacer,
  StatTile,
  Txt,
} from '../../src/components/ui.tsx';
import { useApp, useTransactions } from '../../src/state/store.tsx';
import { spacing } from '../../src/theme/index.ts';

/** Bills shown on the dashboard. Anything further out lives in the Recurring screen. */
const UPCOMING_WINDOW_DAYS = 14;

export default function HomeScreen() {
  const router = useRouter();
  const { data, money, currentPeriod, dispatch, theme } = useApp();
  const transactions = useTransactions();
  const now = today();

  const summary = useMemo(
    () => summarise(data.categories, data.budgets, data.transactions, currentPeriod),
    [data.categories, data.budgets, data.transactions, currentPeriod]
  );

  const statuses = useMemo(
    () => budgetStatuses(data.categories, data.budgets, data.transactions, currentPeriod),
    [data.categories, data.budgets, data.transactions, currentPeriod]
  );

  const budgetedStatuses = statuses.filter((s) => s.budget !== null);
  const hasBudgets = budgetedStatuses.length > 0;

  // With budgets set, the headline is what is left to spend; without them it is
  // simply money in minus money out.
  const headlineValue = hasBudgets ? summary.budgeted - summary.budgetedSpend : summary.net;
  const headlineLabel = hasBudgets ? 'Left to spend' : 'Net this period';

  const spendPace = useMemo(
    () => pace(currentPeriod, hasBudgets ? summary.budgetedSpend : summary.expense, hasBudgets ? summary.budgeted : null, now),
    [currentPeriod, summary, hasBudgets, now]
  );

  const bills = useMemo(
    () => upcoming(data.recurring, UPCOMING_WINDOW_DAYS, now).slice(0, 5),
    [data.recurring, now]
  );

  const goals = useMemo(() => summariseGoals(data.goals, now), [data.goals, now]);
  const recent = transactions.slice(0, 5);

  return (
    <Screen>
      <Body>
        <Txt variant="caption" tone="muted">
          {currentPeriod.label}
        </Txt>
        <Spacer size={spacing.md} />

        <Card>
          <Txt variant="caption" tone="muted">
            {headlineLabel}
          </Txt>
          <Txt
            variant="display"
            tone={headlineValue < 0 ? 'negative' : 'default'}
            numberOfLines={1}
            style={{ marginTop: 2 }}
          >
            {money(headlineValue)}
          </Txt>
          {hasBudgets ? (
            <>
              <Spacer size={spacing.md} />
              <ProgressBar
                progress={summary.budgeted > 0 ? summary.budgetedSpend / summary.budgeted : 0}
                color={summary.budgetedSpend > summary.budgeted ? theme.colors.negative : theme.colors.primary}
              />
              <Spacer size={spacing.sm} />
              <Txt variant="caption" tone="muted">
                {money(summary.budgetedSpend)} of {money(summary.budgeted)} budgeted ·{' '}
                {spendPace.daysRemaining} days left
              </Txt>
              {spendPace.safeDailySpend !== null && spendPace.daysRemaining > 0 ? (
                <Txt variant="caption" tone="faint">
                  About {money(spendPace.safeDailySpend)} a day keeps you on budget
                </Txt>
              ) : null}
            </>
          ) : (
            <>
              <Spacer size={spacing.md} />
              <Txt variant="caption" tone="muted">
                Set budgets to see what you have left to spend.
              </Txt>
            </>
          )}

          <Spacer size={spacing.lg} />
          <Divider />
          <Spacer size={spacing.md} />
          <Row>
            <StatTile label="Money in" value={money(summary.income)} tone="positive" />
            <StatTile label="Money out" value={money(summary.expense)} tone="negative" />
            <StatTile
              label="Saved"
              value={`${Math.round(summary.savingsRate * 100)}%`}
              caption={summary.income > 0 ? 'of income' : 'no income yet'}
            />
          </Row>
        </Card>

        <Spacer />

        {bills.length > 0 ? (
          <>
            <SectionHeader title="Coming up" action="All" onAction={() => router.push('/recurring')} />
            <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
              {bills.map((item, index) => {
                const category = data.categories.find((c) => c.id === item.rule.categoryId);
                return (
                  <View key={`${item.rule.id}-${item.date}`}>
                    {index > 0 ? <Divider /> : null}
                    <ListItem
                      icon={category?.icon ?? '🔁'}
                      iconColor={category?.color}
                      title={item.rule.name}
                      subtitle={`${formatRelativeDay(item.date, now, data.settings.locale)}${
                        item.rule.autoPost ? ' · adds itself' : ''
                      }`}
                      right={
                        <Txt variant="label" tone={item.rule.kind === 'income' ? 'positive' : 'default'}>
                          {money(item.rule.amount)}
                        </Txt>
                      }
                      rightSub={
                        !item.rule.autoPost && item.daysAway <= 0 ? (
                          <Txt
                            variant="caption"
                            tone="primary"
                            style={{ marginTop: 2 }}
                            onPress={() =>
                              dispatch({
                                type: 'recurring/post',
                                ruleId: item.rule.id,
                                date: item.date,
                                transaction: buildTransaction(item.rule, item.date, createId('tx')),
                              })
                            }
                          >
                            Add now
                          </Txt>
                        ) : undefined
                      }
                      onPress={() => router.push(`/recurring/${item.rule.id}`)}
                    />
                  </View>
                );
              })}
            </Card>
            <Spacer />
          </>
        ) : null}

        {hasBudgets ? (
          <>
            <SectionHeader title="Budgets" action="Manage" onAction={() => router.push('/(tabs)/budgets')} />
            <Card>
              {budgetedStatuses.slice(0, 4).map((status, index) => (
                <View key={status.category.id} style={{ marginTop: index === 0 ? 0 : spacing.lg }}>
                  <Row justify="space-between" style={{ marginBottom: 6 }}>
                    <Txt variant="body">
                      {status.category.icon} {status.category.name}
                    </Txt>
                    <Txt
                      variant="label"
                      tone={status.state === 'over' ? 'negative' : status.state === 'warning' ? 'warning' : 'muted'}
                    >
                      {status.remaining >= 0
                        ? `${money(status.remaining)} left`
                        : `${money(Math.abs(status.remaining))} over`}
                    </Txt>
                  </Row>
                  <ProgressBar
                    progress={status.progress}
                    color={
                      status.state === 'over'
                        ? theme.colors.negative
                        : status.state === 'warning'
                          ? theme.colors.warning
                          : status.category.color
                    }
                  />
                </View>
              ))}
            </Card>
            <Spacer />
          </>
        ) : null}

        {goals.activeCount + goals.completedCount > 0 ? (
          <>
            <SectionHeader title="Savings goals" action="All" onAction={() => router.push('/goals')} />
            <Card>
              <Row justify="space-between" style={{ marginBottom: spacing.sm }}>
                <Txt variant="body">
                  {money(goals.totalSaved)} of {money(goals.totalTarget)}
                </Txt>
                <Txt variant="label" tone="muted">
                  {Math.round(goals.progress * 100)}%
                </Txt>
              </Row>
              <ProgressBar progress={goals.progress} />
            </Card>
            <Spacer />
          </>
        ) : null}

        <SectionHeader title="Recent" action="See all" onAction={() => router.push('/(tabs)/transactions')} />
        {recent.length === 0 ? (
          <Card>
            <EmptyState
              icon="👋"
              title="Nothing recorded yet"
              message="Add your first expense or income and the rest of the app fills itself in."
              actionLabel="Add a transaction"
              onAction={() => router.push('/transaction/new')}
            />
          </Card>
        ) : (
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            {recent.map((transaction, index) => {
              const category = data.categories.find((c) => c.id === transaction.categoryId);
              return (
                <View key={transaction.id}>
                  {index > 0 ? <Divider /> : null}
                  <ListItem
                    icon={category?.icon ?? '🧾'}
                    iconColor={category?.color}
                    title={transaction.note || category?.name || 'Transaction'}
                    subtitle={`${category?.name ?? 'Uncategorised'} · ${formatRelativeDay(
                      transaction.date,
                      now,
                      data.settings.locale
                    )}`}
                    right={
                      <Txt variant="label" tone={transaction.kind === 'income' ? 'positive' : 'default'}>
                        {transaction.kind === 'income' ? '+' : '−'}
                        {money(transaction.amount)}
                      </Txt>
                    }
                    onPress={() => router.push(`/transaction/${transaction.id}`)}
                  />
                </View>
              );
            })}
          </Card>
        )}

        <Spacer size={spacing.xl} />
        <Button label="Add transaction" onPress={() => router.push('/transaction/new')} />
      </Body>
      <Fab onPress={() => router.push('/transaction/new')} />
    </Screen>
  );
}
