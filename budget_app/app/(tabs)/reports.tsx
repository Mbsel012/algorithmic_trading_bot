import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatDateLabel, periodFor, shiftPeriod, today } from '../../src/lib/dates.ts';
import { NEUTRAL_COLOR } from '../../src/lib/defaults.ts';
import {
  averageMonthlySpend,
  biggestExpenses,
  categoryBreakdown,
  comparePeriods,
  monthlyTotals,
  runningBalance,
} from '../../src/lib/reports.ts';
import { summarise, transactionsInPeriod } from '../../src/lib/budget.ts';
import { AreaLineChart, DonutChart, GroupedBarChart, RankedBars } from '../../src/components/charts.tsx';
import {
  Body,
  Card,
  Divider,
  EmptyState,
  ListItem,
  Row,
  Screen,
  Segmented,
  Spacer,
  StatTile,
  Txt,
} from '../../src/components/ui.tsx';
import { useApp } from '../../src/state/store.tsx';
import { spacing } from '../../src/theme/index.ts';
import type { TxKind } from '../../src/types.ts';

/** A donut stops being readable past about six segments, so the tail folds in. */
const MAX_DONUT_SLICES = 6;

export default function ReportsScreen() {
  const { data, money, theme } = useApp();
  const [offset, setOffset] = useState(0);
  const [kind, setKind] = useState<TxKind>('expense');
  const [selectedSlice, setSelectedSlice] = useState<string | null>(null);

  const period = useMemo(() => {
    const base = periodFor(today(), data.settings.monthStartDay, data.settings.locale);
    return offset === 0 ? base : shiftPeriod(base, offset, data.settings.monthStartDay, data.settings.locale);
  }, [offset, data.settings.monthStartDay, data.settings.locale]);

  const rows = useMemo(
    () => transactionsInPeriod(data.transactions, period),
    [data.transactions, period]
  );

  const slices = useMemo(
    () => categoryBreakdown(rows, data.categories, kind),
    [rows, data.categories, kind]
  );

  // Top slices keep their own colour; everything else becomes one neutral slice.
  const donutSlices = useMemo(() => {
    if (slices.length <= MAX_DONUT_SLICES) {
      return slices.map((s) => ({ id: s.categoryId, label: s.name, value: s.total, color: s.color }));
    }
    const head = slices.slice(0, MAX_DONUT_SLICES - 1);
    const tail = slices.slice(MAX_DONUT_SLICES - 1);
    return [
      ...head.map((s) => ({ id: s.categoryId, label: s.name, value: s.total, color: s.color })),
      {
        id: '__other__',
        label: `${tail.length} more`,
        value: tail.reduce((acc, s) => acc + s.total, 0),
        color: NEUTRAL_COLOR,
      },
    ];
  }, [slices]);

  const total = slices.reduce((acc, s) => acc + s.total, 0);
  const summary = useMemo(
    () => summarise(data.categories, data.budgets, data.transactions, period),
    [data.categories, data.budgets, data.transactions, period]
  );

  const trend = useMemo(
    () => monthlyTotals(data.transactions, 6, data.settings.monthStartDay, period.end, data.settings.locale),
    [data.transactions, data.settings.monthStartDay, data.settings.locale, period.end]
  );

  const balance = useMemo(() => runningBalance(data.transactions, period), [data.transactions, period]);

  const comparison = useMemo(
    () => comparePeriods(data.transactions, period, data.settings.monthStartDay, kind, data.settings.locale),
    [data.transactions, period, data.settings.monthStartDay, kind, data.settings.locale]
  );

  const average = useMemo(
    () => averageMonthlySpend(data.transactions, 6, data.settings.monthStartDay, period.end),
    [data.transactions, data.settings.monthStartDay, period.end]
  );

  const biggest = useMemo(() => biggestExpenses(data.transactions, period, 5), [data.transactions, period]);

  if (data.transactions.length === 0) {
    return (
      <Screen>
        <Body>
          <Txt variant="title">Reports</Txt>
          <Spacer />
          <Card>
            <EmptyState
              icon="📊"
              title="Nothing to chart yet"
              message="Record a few transactions and your spending patterns will show up here."
            />
          </Card>
        </Body>
      </Screen>
    );
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
          <Row>
            <StatTile label="Money in" value={money(summary.income)} tone="positive" />
            <StatTile label="Money out" value={money(summary.expense)} tone="negative" />
            <StatTile
              label="Net"
              value={money(summary.net, { signed: true })}
              tone={summary.net >= 0 ? 'positive' : 'negative'}
            />
          </Row>
        </Card>

        <Spacer />

        <Segmented
          value={kind}
          onChange={(next) => {
            setKind(next);
            setSelectedSlice(null);
          }}
          options={[
            { value: 'expense', label: 'Where it went' },
            { value: 'income', label: 'Where it came from' },
          ]}
        />
        <Spacer size={spacing.md} />

        <Card>
          {total === 0 ? (
            <EmptyState
              icon="🫥"
              title="Nothing in this period"
              message={`No ${kind === 'expense' ? 'spending' : 'income'} recorded for ${period.label}.`}
            />
          ) : (
            <>
              <View style={{ alignItems: 'center' }}>
                <DonutChart
                  slices={donutSlices}
                  centerValue={money(total, { compact: true })}
                  centerLabel={kind === 'expense' ? 'spent' : 'received'}
                  selectedId={selectedSlice}
                  onSelect={setSelectedSlice}
                />
              </View>
              <Spacer size={spacing.lg} />
              <Divider />
              <Spacer size={spacing.lg} />
              {/* The ranked list carries the exact figures — it doubles as the
                  table view for anyone who can't separate two hues. */}
              <RankedBars
                rows={slices.map((slice) => ({
                  id: slice.categoryId,
                  label: slice.name,
                  icon: slice.icon,
                  value: slice.total,
                  color: slice.color,
                  caption: `${Math.round(slice.share * 100)}% of the total`,
                }))}
                formatValue={(value) => money(value)}
                onPressRow={(id) => setSelectedSlice(selectedSlice === id ? null : id)}
              />
              <Spacer size={spacing.md} />
              <Txt variant="caption" tone="muted">
                {comparison.change === null
                  ? 'No comparable figure for the previous period.'
                  : `${comparison.change >= 0 ? 'Up' : 'Down'} ${Math.abs(
                      Math.round(comparison.change * 100)
                    )}% versus the previous period (${money(comparison.previous)}).`}
              </Txt>
            </>
          )}
        </Card>

        <Spacer />

        <Card>
          <Txt variant="heading">Last 6 periods</Txt>
          <Txt variant="caption" tone="muted" style={{ marginBottom: spacing.md }}>
            Income and spending on the same scale. Tap a period for its figures.
          </Txt>
          <GroupedBarChart
            groups={trend.map((month) => ({
              label: month.label.split(' ')[0].slice(0, 3),
              values: [month.income, month.expense],
            }))}
            seriesColors={[theme.colors.positive, theme.colors.negative]}
            seriesLabels={['Money in', 'Money out']}
            formatValue={(value) => money(value, { compact: true })}
          />
          {average > 0 ? (
            <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm }}>
              Averaging {money(average)} of spending per period.
            </Txt>
          ) : null}
        </Card>

        <Spacer />

        <Card>
          <Txt variant="heading">Running balance</Txt>
          <Txt variant="caption" tone="muted" style={{ marginBottom: spacing.md }}>
            How the period added up, day by day.
          </Txt>
          <AreaLineChart
            points={balance.map((point) => ({
              label: formatDateLabel(point.date, data.settings.locale).replace(/^\w+, /, ''),
              value: point.balance,
            }))}
            color={
              (balance[balance.length - 1]?.balance ?? 0) >= 0 ? theme.colors.positive : theme.colors.negative
            }
            formatValue={(value) => money(value, { signed: true, compact: true })}
          />
        </Card>

        {biggest.length > 0 ? (
          <>
            <Spacer />
            <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
              <Txt variant="heading" style={{ marginTop: spacing.sm }}>
                Biggest single expenses
              </Txt>
              {biggest.map((transaction, index) => {
                const category = data.categories.find((c) => c.id === transaction.categoryId);
                return (
                  <View key={transaction.id}>
                    {index > 0 ? <Divider /> : null}
                    <ListItem
                      icon={category?.icon ?? '🧾'}
                      iconColor={category?.color}
                      title={transaction.note || category?.name || 'Transaction'}
                      subtitle={formatDateLabel(transaction.date, data.settings.locale)}
                      right={<Txt variant="label">{money(transaction.amount)}</Txt>}
                    />
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}
      </Body>
    </Screen>
  );
}
