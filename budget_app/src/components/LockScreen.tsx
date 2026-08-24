/** The screen shown in place of the app while it is locked. */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { ATTEMPTS_BEFORE_LOCKOUT, remainingLockoutMs } from '../lib/lock.ts';
import { useLock } from '../state/lockContext.tsx';
import { useTheme } from '../state/store.tsx';
import { spacing } from '../theme/index.ts';
import { PinPad } from './PinPad.tsx';
import { Screen, Txt } from './ui.tsx';

function formatWait(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

export function LockScreen() {
  const theme = useTheme();
  const { attempts, biometric, config, submitPin, tryBiometric } = useLock();
  const [error, setError] = useState<string | null>(null);
  const [waitMs, setWaitMs] = useState(0);
  const promptedOnce = useRef(false);

  const refreshWait = useCallback(
    () => setWaitMs(remainingLockoutMs(attempts.failed, attempts.lastFailureAt, Date.now())),
    [attempts.failed, attempts.lastFailureAt]
  );

  // Tick the countdown while a lockout is running.
  useEffect(() => {
    refreshWait();
    const timer = setInterval(refreshWait, 500);
    return () => clearInterval(timer);
  }, [refreshWait]);

  // Offer the biometric prompt straight away, but only once per lock, so a
  // cancelled prompt doesn't immediately reappear and trap the user.
  useEffect(() => {
    if (promptedOnce.current) return;
    if (!config.biometrics || !biometric.usable || waitMs > 0) return;
    promptedOnce.current = true;
    void tryBiometric();
  }, [config.biometrics, biometric.usable, waitMs, tryBiometric]);

  async function onSubmit(pin: string) {
    if (waitMs > 0) return;
    const ok = await submitPin(pin);
    if (!ok) {
      const nextFailed = attempts.failed + 1;
      const left = ATTEMPTS_BEFORE_LOCKOUT - nextFailed;
      setError(
        left > 0 && left <= 2
          ? `Wrong PIN — ${left} ${left === 1 ? 'try' : 'tries'} left before a wait.`
          : 'Wrong PIN.'
      );
    }
  }

  const lockedOut = waitMs > 0;

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <Txt style={{ fontSize: 44 }}>{lockedOut ? '⏳' : '🔒'}</Txt>
        </View>
        <PinPad
          title={lockedOut ? 'Too many attempts' : 'Enter your PIN'}
          subtitle={
            lockedOut
              ? `Try again in ${formatWait(waitMs)}.`
              : config.biometrics && biometric.usable
                ? `Or unlock with ${biometric.label}.`
                : undefined
          }
          error={error}
          disabled={lockedOut}
          onSubmit={onSubmit}
          onBiometric={config.biometrics && biometric.usable ? () => void tryBiometric() : undefined}
          biometricLabel={biometric.label}
        />
        <Txt
          variant="caption"
          tone="faint"
          style={{ textAlign: 'center', marginTop: spacing.xl, color: theme.colors.textFaint }}
        >
          Your data never leaves this device — there is no account to reset a
          forgotten PIN with. Reinstalling the app clears it, and your data with it.
        </Txt>
      </View>
    </Screen>
  );
}
