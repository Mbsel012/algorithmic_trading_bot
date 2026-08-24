import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { CATEGORY_COLORS } from '../src/lib/defaults.ts';
import { createId } from '../src/lib/id.ts';
import { ColorPicker, Field, IconPicker, TextField } from '../src/components/fields.tsx';
import {
  Body,
  Button,
  Card,
  Divider,
  ListItem,
  Row,
  Screen,
  Segmented,
  Sheet,
  Spacer,
  Txt,
} from '../src/components/ui.tsx';
import { useApp } from '../src/state/store.tsx';
import { spacing } from '../src/theme/index.ts';
import type { Category, TxKind } from '../src/types.ts';

export default function CategoriesScreen() {
  const { data, dispatch, money } = useApp();
  const [kind, setKind] = useState<TxKind>('expense');
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🧾');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);

  const categories = useMemo(
    () =>
      data.categories
        .filter((c) => c.kind === kind)
        .sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name)),
    [data.categories, kind]
  );

  const usage = useMemo(() => {
    const totals = new Map<string, { count: number; total: number }>();
    for (const t of data.transactions) {
      const entry = totals.get(t.categoryId) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += t.amount;
      totals.set(t.categoryId, entry);
    }
    return totals;
  }, [data.transactions]);

  function open(category: Category | null) {
    setEditing(category ?? ({ id: '', name: '', icon: '🧾', color: CATEGORY_COLORS[0], kind, archived: false } as Category));
    setName(category?.name ?? '');
    setIcon(category?.icon ?? '🧾');
    setColor(category?.color ?? CATEGORY_COLORS[data.categories.length % CATEGORY_COLORS.length]);
  }

  function save() {
    if (!editing || !name.trim()) return;
    if (editing.id) {
      dispatch({ type: 'category/update', category: { ...editing, name: name.trim(), icon, color } });
    } else {
      dispatch({
        type: 'category/add',
        category: { id: createId('cat'), name: name.trim(), icon, color, kind, archived: false },
      });
    }
    setEditing(null);
  }

  function remove(category: Category) {
    const used = usage.get(category.id);
    const message = used
      ? `${used.count} transactions use this category. It will be hidden rather than deleted so your history stays intact.`
      : 'This category is not used anywhere.';
    Alert.alert(`Delete ${category.name}?`, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: used ? 'Hide it' : 'Delete',
        style: 'destructive',
        onPress: () => {
          dispatch({ type: 'category/delete', id: category.id });
          setEditing(null);
        },
      },
    ]);
  }

  return (
    <Screen edges={['bottom']}>
      <Body>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Spending' },
            { value: 'income', label: 'Income' },
          ]}
        />
        <Spacer />

        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          {categories.map((category, index) => {
            const used = usage.get(category.id);
            return (
              <View key={category.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  icon={category.icon}
                  iconColor={category.color}
                  title={category.archived ? `${category.name} (hidden)` : category.name}
                  subtitle={
                    used ? `${used.count} transactions · ${money(used.total)}` : 'Not used yet'
                  }
                  right={
                    <Txt variant="caption" tone="primary">
                      Edit
                    </Txt>
                  }
                  onPress={() => open(category)}
                />
              </View>
            );
          })}
        </Card>

        <Spacer />
        <Button label="New category" onPress={() => open(null)} />
      </Body>

      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit category' : 'New category'}
      >
        <Field label="Name">
          <TextField value={name} onChangeText={setName} placeholder="Groceries" autoFocus />
        </Field>
        <Field label="Icon">
          <IconPicker value={icon} onChange={setIcon} />
        </Field>
        <Field label="Colour">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        {editing?.archived ? (
          <Button
            label="Unhide this category"
            variant="secondary"
            style={{ marginBottom: spacing.md }}
            onPress={() => {
              dispatch({ type: 'category/update', category: { ...editing, archived: false } });
              setEditing(null);
            }}
          />
        ) : null}
        <Row gap={spacing.md}>
          {editing?.id ? (
            <View style={{ flex: 1 }}>
              <Button label="Delete" variant="danger" onPress={() => remove(editing)} />
            </View>
          ) : null}
          <View style={{ flex: 2 }}>
            <Button label="Save" onPress={save} />
          </View>
        </Row>
      </Sheet>
    </Screen>
  );
}
