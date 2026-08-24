/**
 * The numeric keypad used both to unlock the app and to choose a new PIN.
 *
 * It deliberately avoids a normal text input: no keyboard means no autofill,
 * no clipboard suggestions and no chance of the PIN turning up in a keyboard's
 * learned-words store.
 */

import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';

import { MAX_PIN_LENGTH, MIN_PIN_LENGTH } from '../lib/lock.ts';
import { useTheme } from '../state/store.tsx';
import { radius, spacing } from '../theme/index.ts';
import { Txt } from './ui.tsx';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function tap(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  // Haptics are a nicety; a device without a motor should not throw.
  Haptics.impactAsync(style).catch(() => undefined);
}

export function PinPad({
  title,
  subtitle,
  error,
  disabled = false,
  submitLabel = '✓',
  onSubmit,
  onBiometric,
  biometricLabel,
  resetKey,
}: {
  title: string;
  subtitle?: string;
  error?: string | null;
  disabled?: boolean;
  submitLabel?: string;
  onSubmit: (pin: string) => void;
  onBiometric?: () => void;
  biometricLabel?: string;
  /** Change this to clear the entry — used between the two setup steps. */
  resetKey?: string | number;
}) {
  const theme = useTheme();
  const [pin, setPin] = useState('');
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setPin('');
  }, [resetKey]);

  // Clear the entry and shake the dots whenever a new error arrives.
  useEffect(() => {
    if (!error) return;
    setPin('');
    tap(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [error, shake]);

  function press(key: string) {
    if (disabled || pin.length >= MAX_PIN_LENGTH) return;
    tap();
    setPin(pin + key);
  }

  function backspace() {
    if (disabled || pin.length === 0) return;
    tap();
    setPin(pin.slice(0, -1));
  }

  function submit() {
    if (disabled || pin.length < MIN_PIN_LENGTH) return;
    onSubmit(pin);
  }

  const canSubmit = !disabled && pin.length >= MIN_PIN_LENGTH;

  return (
    <View style={{ alignItems: 'center', gap: spacing.lg }}>
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Txt variant="title">{title}</Txt>
        {subtitle ? (
          <Txt tone="muted" style={{ textAlign: 'center' }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>

      <Animated.View
        style={{
          flexDirection: 'row',
          gap: spacing.md,
          height: 24,
          alignItems: 'center',
          transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-12, 12] }) }],
        }}
      >
        {Array.from({ length: Math.max(MIN_PIN_LENGTH, pin.length) }).map((_, index) => (
          <View
            key={index}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              borderWidth: 1.5,
              borderColor: index < pin.length ? theme.colors.primary : theme.colors.border,
              backgroundColor: index < pin.length ? theme.colors.primary : 'transparent',
            }}
          />
        ))}
      </Animated.View>

      <View style={{ height: 20 }}>
        {error ? (
          <Txt variant="caption" tone="negative" style={{ textAlign: 'center' }}>
            {error}
          </Txt>
        ) : null}
      </View>

      <View style={{ width: 264, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {KEYS.map((key) => (
          <Key key={key} label={key} onPress={() => press(key)} disabled={disabled} />
        ))}
        {onBiometric && biometricLabel ? (
          <Key
            label={biometricLabel === 'Face ID' ? '🙂' : '☝️'}
            onPress={onBiometric}
            disabled={disabled}
            accessibilityLabel={`Unlock with ${biometricLabel}`}
            muted
          />
        ) : (
          <Key label="" onPress={() => undefined} disabled hidden />
        )}
        <Key label="0" onPress={() => press('0')} disabled={disabled} />
        {pin.length >= MIN_PIN_LENGTH ? (
          <Key
            label={submitLabel}
            onPress={submit}
            disabled={!canSubmit}
            accessibilityLabel="Confirm"
            accent
          />
        ) : (
          <Key label="⌫" onPress={backspace} disabled={disabled || pin.length === 0} accessibilityLabel="Delete" muted />
        )}
      </View>

      {pin.length >= MIN_PIN_LENGTH ? (
        <Txt variant="caption" tone="primary" onPress={backspace}>
          Delete a digit
        </Txt>
      ) : null}
    </View>
  );
}

function Key({
  label,
  onPress,
  disabled,
  accent = false,
  muted = false,
  hidden = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accent?: boolean;
  muted?: boolean;
  hidden?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  if (hidden) return <View style={{ width: 80, height: 64 }} />;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => ({
        width: 80,
        height: 64,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: accent ? theme.colors.primary : muted ? 'transparent' : theme.colors.surface,
        borderWidth: muted || accent ? 0 : 1,
        borderColor: theme.colors.border,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <Txt
        variant="title"
        style={{
          color: accent ? theme.colors.primaryText : theme.colors.text,
          fontWeight: Platform.OS === 'ios' ? '500' : '600',
        }}
      >
        {label}
      </Txt>
    </Pressable>
  );
}
