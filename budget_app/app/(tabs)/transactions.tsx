import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';

import { formatDateLabel, formatRelativeDay, monthKey, today } from '../../src/lib/dates.ts';
import { sum } from '../../src/lib/money.ts';
import {
  Card,
  Chip,
  Divider,
  EmptyState,
  Fab,
  ListItem,
  Row,
  Screen,
  Segmented,
  Txt,
} from '../../src/components/ui.tsx';
import { TextField } from '../../src/components/fields.tsx';
import { useApp, useTransactions } from '../../src/state/store.tsx';
import { spacing } from '../../src/theme/index.ts';
import type { Transaction } from '../../src/types.ts';

type Filter = 'all' | 'expense' | 'income';

export default function TransactionsScreen() {
  const router = useRouter();
  const { data, money, theme } = useApp();
  const transactions = useTransactions();
  const [filter, setFilter] = useState<Filter>('all');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const now = today();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (filter !== 'all' && t.kind !== filter) return false;
      if (categoryId && t.categoryId !== categoryId) return false;
      if (!needle) return true;
      const category = data.categories.find((c) => c.id === t.categoryId);
      return (
        t.note.toLowerCase().includes(needle) ||
        (category?.name ?? '').toLowerCase().includes(needle)
      );
    });
  }, [transactions, filter, categoryId, query, data.categories]);

  // Group by month so long histories stay navigable.
  const sections = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const key = monthKey(t.date);
      const bucket = groups.get(key);
      if (bucket) bucket.push(t);
      else groups.set(key, [t]);
    }
    return [...groups.entries()].map(([key, rows]) => ({
      title: key,
      net: sum(rows.map((r) => (r.kind === 'income' ? r.amount : -r.amount))),
      data: rows,
    }));
  }, [filtered]);

  const usedCategories = useMemo(() => {
    const ids = new Set(transactions.map((t) => t.categoryId));
    return data.categories.filter((c) => ids.has(c.id));
  }, [transactions, data.categories]);

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md }}>
        <Txt variant="title">Activity</Txt>
        <TextField value={query} onChangeText={setQuery} placeholder="Search notes and categories" />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'expense', label: 'Spending' },
            { value: 'income', label: 'Income' },
          ]}
        />
        {usedCategories.length > 1 ? (
          <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
            <Chip label="Every category" selected={categoryId === null} onPress={() => setCategoryId(null)} />
            {usedCategories.map((category) => (
              <Chip
                key={category.id}
                label={`${category.icon} ${category.name}`}
                color={category.color}
                selected={categoryId === category.id}
                onPress={() => setCategoryId(categoryId === category.id ? null : category.id)}
              />
            ))}
          </Row>
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 3 }}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Card>
            <EmptyState
              icon="🔍"
              title={transactions.length === 0 ? 'No transactions yet' : 'Nothing matches'}
              message={
                transactions.length === 0
                  ? 'Tap the plus button to record your first one.'
                  : 'Try a different search or clear the filters.'
              }
            />
          </Card>
        }
        renderSectionHeader={({ section }) => (
          <Row justify="space-between" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
            <Txt variant="label" tone="muted">
              {formatDateLabel(`${section.title}-01`, data.settings.locale).replace(/^\w+, /, '')}
            </Txt>
            <Txt variant="label" tone={section.net >= 0 ? 'positive' : 'muted'}>
              {money(section.net, { signed: true })}
            </Txt>
          </Row>
        )}
        renderItem={({ item, index, section }) => {
          const category = data.categories.find((c) => c.id === item.categoryId);
          return (
            <View
              style={{
                backgroundColor: theme.colors.surface,
                paddingHorizontal: spacing.lg,
                borderTopLeftRadius: index === 0 ? 18 : 0,
                borderTopRightRadius: index === 0 ? 18 : 0,
                borderBottomLeftRadius: index === section.data.length - 1 ? 18 : 0,
                borderBottomRightRadius: index === section.data.length - 1 ? 18 : 0,
              }}
            >
              {index > 0 ? <Divider /> : null}
              <ListItem
                icon={category?.icon ?? '🧾'}
                iconColor={category?.color}
                title={item.note || category?.name || 'Transaction'}
                subtitle={`${category?.name ?? 'Uncategorised'} · ${formatRelativeDay(
                  item.date,
                  now,
                  data.settings.locale
                )}${item.recurringId ? ' · recurring' : ''}`}
                right={
                  <Txt variant="label" tone={item.kind === 'income' ? 'positive' : 'default'}>
                    {item.kind === 'income' ? '+' : '−'}
                    {money(item.amount)}
                  </Txt>
                }
                onPress={() => router.push(`/transaction/${item.id}`)}
              />
            </View>
          );
        }}
      />
      <Fab onPress={() => router.push('/transaction/new')} />
    </Screen>
  );
}
