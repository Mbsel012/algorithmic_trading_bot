/** Small shared building blocks. Every one reads its colours from the theme. */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../state/store.tsx';
import { radius, spacing } from '../theme/index.ts';

export function Screen({
  children,
  style,
  edges = ['top'],
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Body({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      contentContainerStyle={[{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';

const VARIANT_SIZE: Record<TextVariant, { fontSize: number; fontWeight: TextStyle['fontWeight'] }> = {
  display: { fontSize: 38, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
};

export function Txt({
  children,
  variant = 'body',
  tone = 'default',
  style,
  numberOfLines,
  onPress,
}: {
  children: React.ReactNode;
  variant?: TextVariant;
  tone?: 'default' | 'muted' | 'faint' | 'positive' | 'negative' | 'warning' | 'primary';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const color =
    tone === 'muted'
      ? theme.colors.textMuted
      : tone === 'faint'
        ? theme.colors.textFaint
        : tone === 'positive'
          ? theme.colors.positive
          : tone === 'negative'
            ? theme.colors.negative
            : tone === 'warning'
              ? theme.colors.warning
              : tone === 'primary'
                ? theme.colors.primary
                : theme.colors.text;
  return (
    <Text
      numberOfLines={numberOfLines}
      onPress={onPress}
      suppressHighlighting={onPress ? false : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[VARIANT_SIZE[variant], { color }, style]}
    >
      {children}
    </Text>
  );
}

export function Row({
  children,
  gap = spacing.md,
  align = 'center',
  justify = 'flex-start',
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: align, justifyContent: justify, gap }, style]}>
      {children}
    </View>
  );
}

export function Spacer({ size = spacing.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }} />;
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <Row justify="space-between" style={{ marginBottom: spacing.sm }}>
      <Txt variant="heading">{title}</Txt>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Txt variant="label" tone="primary">
            {action}
          </Txt>
        </Pressable>
      ) : null}
    </Row>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const background =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'secondary'
        ? theme.colors.surfaceAlt
        : variant === 'danger'
          ? theme.colors.negative
          : 'transparent';
  const color =
    variant === 'primary'
      ? theme.colors.primaryText
      : variant === 'danger'
        ? '#FFFFFF'
        : variant === 'ghost'
          ? theme.colors.primary
          : theme.colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          backgroundColor: background,
          paddingVertical: 14,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={{ color, fontSize: 15, fontWeight: '600' }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  color?: string;
}) {
  const theme = useTheme();
  const accent = color ?? theme.colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? accent : theme.colors.border,
        backgroundColor: selected ? `${accent}22` : theme.colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? accent : theme.colors.textMuted,
          fontWeight: selected ? '700' : '500',
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: radius.md,
        padding: 3,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: radius.sm,
              alignItems: 'center',
              backgroundColor: active ? theme.colors.surface : 'transparent',
            }}
          >
            <Text
              style={{
                color: active ? theme.colors.text : theme.colors.textMuted,
                fontWeight: active ? '700' : '500',
                fontSize: 14,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({
  progress,
  color,
  height = 8,
  track,
}: {
  progress: number;
  color?: string;
  height?: number;
  track?: string;
}) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: track ?? theme.colors.track,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color ?? theme.colors.primary,
        }}
      />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm }}>
      <Text style={{ fontSize: 40 }}>{icon}</Text>
      <Txt variant="heading">{title}</Txt>
      <Txt tone="muted" style={{ textAlign: 'center', maxWidth: 280 }}>
        {message}
      </Txt>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: spacing.md, paddingHorizontal: spacing.xl }} />
      ) : null}
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          maxHeight: '80%',
        }}
      >
        <Row justify="space-between" style={{ marginBottom: spacing.md }}>
          <Txt variant="heading">{title}</Txt>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Txt variant="heading" tone="muted">
              ✕
            </Txt>
          </Pressable>
        </Row>
        <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </Modal>
  );
}

export function ListItem({
  icon,
  iconColor,
  title,
  subtitle,
  right,
  rightSub,
  onPress,
  onLongPress,
}: {
  icon?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  rightSub?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        opacity: pressed && onPress ? 0.65 : 1,
      })}
    >
      {icon ? (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: iconColor ? `${iconColor}22` : theme.colors.surfaceAlt,
          }}
        >
          <Text style={{ fontSize: 19 }}>{icon}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Txt variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {right}
        {rightSub}
      </View>
    </Pressable>
  );
}

/**
 * A headline figure with an optional caption. Per the visualisation rules, a
 * single current value is a stat tile — not a one-bar chart.
 */
export function StatTile({
  label,
  value,
  caption,
  tone = 'default',
  style,
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: 'default' | 'positive' | 'negative' | 'muted';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flex: 1, gap: 2 }, style]}>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
      <Txt variant="heading" tone={tone === 'muted' ? 'muted' : tone} numberOfLines={1}>
        {value}
      </Txt>
      {caption ? (
        <Txt variant="caption" tone="faint" numberOfLines={1}>
          {caption}
        </Txt>
      ) : null}
    </View>
  );
}

export function Fab({ onPress, label = '+' }: { onPress: () => void; label?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add transaction"
      style={({ pressed }) => ({
        position: 'absolute',
        right: spacing.lg,
        bottom: spacing.lg,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      })}
    >
      <Text style={{ fontSize: 28, lineHeight: 32, color: theme.colors.primaryText, fontWeight: '400' }}>
        {label}
      </Text>
    </Pressable>
  );
}
