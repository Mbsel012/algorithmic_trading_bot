/** Form inputs: text, money, dates, categories. */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  addMonths,
  daysInMonth,
  formatDateLabel,
  formatMonthLabel,
  monthKey,
  pad2,
  today,
  type ISODate,
} from '../lib/dates.ts';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../lib/defaults.ts';
import { toDecimalString } from '../lib/money.ts';
import { useApp, useTheme } from '../state/store.tsx';
import { radius, spacing } from '../theme/index.ts';
import type { Category } from '../types.ts';
import { Chip, Row, Sheet, Txt } from './ui.tsx';

export function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <View style={{ gap: spacing.xs, marginBottom: spacing.lg }}>
      <Txt variant="label" tone="muted">
        {label}
      </Txt>
      {children}
      {error ? (
        <Txt variant="caption" tone="negative">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="caption" tone="faint">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  autoFocus = false,
  maxLength,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  autoFocus?: boolean;
  maxLength?: number;
}) {
  const theme = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textFaint}
      multiline={multiline}
      keyboardType={keyboardType}
      autoFocus={autoFocus}
      maxLength={maxLength}
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        fontSize: 16,
        color: theme.colors.text,
        minHeight: multiline ? 88 : undefined,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
    />
  );
}

/**
 * Amount entry. The raw text is kept as typed so a half-finished "12." never
 * gets rewritten under the user's cursor; the parent parses it on save.
 */
export function AmountField({
  value,
  onChangeText,
  autoFocus = false,
  tone,
  currency,
  onPressCurrency,
}: {
  value: string;
  onChangeText: (value: string) => void;
  autoFocus?: boolean;
  tone?: 'positive' | 'negative';
  /** Overrides the home currency, for entering a foreign amount. */
  currency?: string;
  /** When given, the currency label becomes a button. */
  onPressCurrency?: () => void;
}) {
  const theme = useTheme();
  const { data } = useApp();
  const code = currency ?? data.settings.currency;
  const color =
    tone === 'positive' ? theme.colors.positive : tone === 'negative' ? theme.colors.negative : theme.colors.text;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
      }}
    >
      <Pressable onPress={onPressCurrency} disabled={!onPressCurrency} hitSlop={8}>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '600',
            color: onPressCurrency ? theme.colors.primary : theme.colors.textMuted,
          }}
        >
          {code}
          {onPressCurrency ? ' ▾' : ''}
        </Text>
      </Pressable>
      <TextInput
        value={value}
        onChangeText={(next) => onChangeText(next.replace(/[^0-9.,-]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={theme.colors.textFaint}
        autoFocus={autoFocus}
        style={{
          flex: 1,
          fontSize: 32,
          fontWeight: '700',
          color,
          paddingVertical: spacing.md,
          textAlign: 'right',
        }}
      />
    </View>
  );
}

export function amountToInput(cents: number, currency: string): string {
  return cents === 0 ? '' : toDecimalString(cents, currency);
}

/** A tappable date field backed by a small month-grid picker. */
export function DateField({
  value,
  onChange,
  allowClear = false,
  placeholder = 'No date',
}: {
  value: ISODate | null;
  onChange: (value: ISODate | null) => void;
  allowClear?: boolean;
  placeholder?: string;
}) {
  const theme = useTheme();
  const { data } = useApp();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => monthKey(value ?? today()));

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);

  return (
    <>
      <Pressable
        onPress={() => {
          setCursor(monthKey(value ?? today()));
          setOpen(true);
        }}
        accessibilityRole="button"
        style={{
          backgroundColor: theme.colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 14,
        }}
      >
        <Txt tone={value ? 'default' : 'faint'}>
          {value ? formatDateLabel(value, data.settings.locale) : placeholder}
        </Txt>
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Pick a date">
        <Row justify="space-between" style={{ marginBottom: spacing.md }}>
          <Pressable onPress={() => setCursor(monthKey(addMonths(`${cursor}-01`, -1)))} hitSlop={12}>
            <Txt variant="heading" tone="primary">
              ‹
            </Txt>
          </Pressable>
          <Txt variant="heading">{formatMonthLabel(cursor, data.settings.locale)}</Txt>
          <Pressable onPress={() => setCursor(monthKey(addMonths(`${cursor}-01`, 1)))} hitSlop={12}>
            <Txt variant="heading" tone="primary">
              ›
            </Txt>
          </Pressable>
        </Row>

        <Row gap={0} style={{ marginBottom: spacing.xs }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
            <View key={`${label}${index}`} style={{ flex: 1, alignItems: 'center' }}>
              <Txt variant="caption" tone="faint">
                {label}
              </Txt>
            </View>
          ))}
        </Row>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {grid.map((cell, index) => {
            const selected = cell !== null && cell === value;
            const isToday = cell !== null && cell === today();
            return (
              <View key={index} style={{ width: `${100 / 7}%`, padding: 2 }}>
                {cell === null ? (
                  <View style={{ height: 40 }} />
                ) : (
                  <Pressable
                    onPress={() => {
                      onChange(cell);
                      setOpen(false);
                    }}
                    style={{
                      height: 40,
                      borderRadius: radius.sm,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected ? theme.colors.primary : 'transparent',
                      borderWidth: isToday && !selected ? 1 : 0,
                      borderColor: theme.colors.primary,
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? theme.colors.primaryText : theme.colors.text,
                        fontWeight: selected ? '700' : '400',
                      }}
                    >
                      {Number(cell.slice(8, 10))}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>

        <Row gap={spacing.sm} style={{ marginTop: spacing.lg }}>
          <Chip
            label="Today"
            onPress={() => {
              onChange(today());
              setOpen(false);
            }}
          />
          {allowClear ? (
            <Chip
              label="Clear"
              onPress={() => {
                onChange(null);
                setOpen(false);
              }}
            />
          ) : null}
        </Row>
      </Sheet>
    </>
  );
}

/** Days of a month padded with nulls so the 1st lands on the right weekday. */
function buildMonthGrid(key: string): (ISODate | null)[] {
  const [year, month] = key.split('-').map(Number);
  const firstWeekday = new Date(year, month - 1, 1, 12).getDay();
  const total = daysInMonth(year, month);
  const cells: (ISODate | null)[] = new Array(firstWeekday).fill(null);
  for (let day = 1; day <= total; day += 1) cells.push(`${key}-${pad2(day)}`);
  return cells;
}

export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {categories.map((category) => (
        <Chip
          key={category.id}
          label={`${category.icon} ${category.name}`}
          color={category.color}
          selected={category.id === value}
          onPress={() => onChange(category.id)}
        />
      ))}
    </View>
  );
}

export function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {CATEGORY_ICONS.map((icon) => (
        <Pressable
          key={icon}
          onPress={() => onChange(icon)}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: icon === value ? 2 : StyleSheet.hairlineWidth,
            borderColor: icon === value ? theme.colors.primary : theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Text style={{ fontSize: 20 }}>{icon}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {CATEGORY_COLORS.map((color) => (
        <Pressable
          key={color}
          onPress={() => onChange(color)}
          accessibilityRole="button"
          accessibilityLabel={`Colour ${color}`}
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.pill,
            backgroundColor: color,
            borderWidth: color === value ? 3 : 0,
            borderColor: theme.colors.text,
          }}
        />
      ))}
    </View>
  );
}
