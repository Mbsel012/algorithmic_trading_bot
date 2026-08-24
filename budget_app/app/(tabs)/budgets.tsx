import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { budgetStatuses, effectiveBudget, pace, summarise } from '../../src/lib/budget.ts';
import { periodFor, shiftPeriod, today } from '../../src/lib/dates.ts';
import { createId } from '../../src/lib/id.ts';
import { parseAmount, toDecimalString } from '../../src/lib/money.ts';
import { AmountField, Field } from '../../src/components/fields.tsx';
import {
  Body,
  Button,
  Card,
  Divider,
  EmptyState,
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
import type { Category } from '../../src/types.ts';

export default function BudgetsScreen() {
  const { data, money, theme, dispatch } = useApp();
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Category | null>(null);
  const [draft, setDraft] = useState('');
  const [thisMonthOnly, setThisMonthOnly] = useState(false);

  const period = useMemo(() => {
    const base = periodFor(today(), data.settings.monthStartDay, data.settings.locale);
    return offset === 0 ? base : shiftPeriod(base, offset, data.settings.monthStartDay, data.settings.locale);
  }, [offset, data.settings.monthStartDay, data.settings.locale]);

  const statuses = useMemo(
    () => budgetStatuses(data.categories, data.budgets, data.transactions, period),
    [data.categories, data.budgets, data.transactions, period]
  );
  const summary = useMemo(
    () => summarise(data.categories, data.budgets, data.transactions, period),
    [data.categories, data.budgets, data.transactions, period]
  );
  const spendPace = useMemo(
    () => pace(period, summary.budgetedSpend, summary.budgeted || null, today()),
    [period, summary]
  );

  const budgeted = statuses.filter((s) => s.budget !== null);
  const unbudgeted = statuses.filter((s) => s.budget === null);
  const left = summary.budgeted - summary.budgetedSpend;

  function openEditor(category: Category) {
    const monthly = effectiveBudget(data.budgets, category.id, period.key);
    const override = data.budgets.find((b) => b.categoryId === category.id && b.month === period.key);
    setEditing(category);
    setThisMonthOnly(Boolean(override));
    setDraft(monthly ? toDecimalString(monthly, data.settings.currency) : '');
  }

  function saveBudget() {
    if (!editing) return;
    const cents = parseAmount(draft) ?? 0;
    dispatch({
      type: 'budget/set',
      budget: {
        id: createId('bud'),
        categoryId: editing.id,
        amount: Math.max(0, cents),
        month: thisMonthOnly ? period.key : null,
      },
    });
    // Clearing a standing budget should not leave an override behind.
    if (cents <= 0 && !thisMonthOnly) {
      dispatch({ type: 'budget/clear', categoryId: editing.id, month: period.key });
    }
    setEditing(null);
  }

  return (
    <Screen>
      <Body>
        <Row justify="space-between">
          <Pressable onPress={() => setOffset(offset - 1)} hitSlop={12} accessibilityLabel="Previous period">
            <Txt variant="title" tone="primary">
              ‹
            </Txt>
          </Pressable>
          <Txt variant="heading">{period.label}</Txt>
          <Pressable onPress={() => setOffset(offset + 1)} hitSlop={12} accessibilityLabel="Next period">
            <Txt variant="title" tone="primary">
              ›
            </Txt>
          </Pressable>
        </Row>
        <Spacer size={spacing.md} />

        <Card>
          <Txt variant="caption" tone="muted">
            {summary.budgeted > 0 ? 'Left in budgets' : 'Nothing budgeted yet'}
          </Txt>
          <Txt variant="display" tone={left < 0 ? 'negative' : 'default'} numberOfLines={1}>
            {money(left)}
          </Txt>
          <Spacer size={spacing.md} />
          <ProgressBar
            progress={summary.budgeted > 0 ? summary.budgetedSpend / summary.budgeted : 0}
            color={left < 0 ? theme.colors.negative : theme.colors.primary}
          />
          <Spacer size={spacing.md} />
          <Row>
            <StatTile label="Budgeted" value={money(summary.budgeted)} />
            <StatTile label="Spent" value={money(summary.budgetedSpend)} />
            <StatTile
              label="Per day left"
              value={spendPace.safeDailySpend !== null ? money(spendPace.safeDailySpend) : '—'}
              caption={`${spendPace.daysRemaining} days to go`}
            />
          </Row>
        </Card>

        <Spacer />

        {budgeted.length === 0 && unbudgeted.length === 0 ? (
          <Card>
            <EmptyState
              icon="🎯"
              title="No expense categories"
              message="Add a category in More › Categories, then set a monthly limit for it here."
            />
          </Card>
        ) : null}

        {budgeted.length > 0 ? (
          <>
            <Txt variant="heading" style={{ marginBottom: spacing.sm }}>
              With a limit
            </Txt>
            <Card>
              {budgeted.map((status, index) => (
                <View key={status.category.id}>
                  {index > 0 ? (
                    <View style={{ marginVertical: spacing.md }}>
                      <Divider />
                    </View>
                  ) : null}
                  <Pressable onPress={() => openEditor(status.category)}>
                    <Row justify="space-between" style={{ marginBottom: 6 }}>
                      <Txt variant="body">
                        {status.category.icon} {status.category.name}
                      </Txt>
                      <Txt variant="label" tone={status.state === 'over' ? 'negative' : 'muted'}>
                        {money(status.spent)} / {money(status.budget ?? 0)}
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
                    <Txt variant="caption" tone="faint" style={{ marginTop: 4 }}>
                      {status.remaining >= 0
                        ? `${money(status.remaining)} left · ${Math.round(status.progress * 100)}% used`
                        : `${money(Math.abs(status.remaining))} over budget`}
                    </Txt>
                  </Pressable>
                </View>
              ))}
            </Card>
            <Spacer />
          </>
        ) : null}

        {unbudgeted.length > 0 ? (
          <>
            <Txt variant="heading" style={{ marginBottom: spacing.sm }}>
              No limit set
            </Txt>
            <Card>
              {unbudgeted.map((status, index) => (
                <View key={status.category.id}>
                  {index > 0 ? (
                    <View style={{ marginVertical: spacing.md }}>
                      <Divider />
                    </View>
                  ) : null}
                  <Pressable onPress={() => openEditor(status.category)}>
                    <Row justify="space-between">
                      <Txt variant="body">
                        {status.category.icon} {status.category.name}
                      </Txt>
                      <Row gap={spacing.sm}>
                        <Txt variant="label" tone="muted">
                          {money(status.spent)} spent
                        </Txt>
                        <Txt variant="label" tone="primary">
                          Set
                        </Txt>
                      </Row>
                    </Row>
                  </Pressable>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </Body>

      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.icon} ${editing.name}` : ''}
      >
        <Field label="Monthly limit" hint="Set 0 to remove the limit.">
          <AmountField value={draft} onChangeText={setDraft} autoFocus />
        </Field>
        <Pressable onPress={() => setThisMonthOnly(!thisMonthOnly)} style={{ marginBottom: spacing.lg }}>
          <Row gap={spacing.md}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: thisMonthOnly ? theme.colors.primary : theme.colors.border,
                backgroundColor: thisMonthOnly ? theme.colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {thisMonthOnly ? (
                <Txt variant="caption" style={{ color: theme.colors.primaryText, fontWeight: '700' }}>
                  ✓
                </Txt>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="body">Just for {period.label}</Txt>
              <Txt variant="caption" tone="faint">
                Leave off to use this limit every period.
              </Txt>
            </View>
          </Row>
        </Pressable>
        <Button label="Save limit" onPress={saveBudget} />
      </Sheet>
    </Screen>
  );
}
