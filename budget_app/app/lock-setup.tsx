import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { describePinProblem, validatePin } from '../src/lib/lock.ts';
import { PinPad } from '../src/components/PinPad.tsx';
import { Screen, Txt } from '../src/components/ui.tsx';
import { useLock } from '../src/state/lockContext.tsx';
import { spacing } from '../src/theme/index.ts';

type Mode = 'new' | 'change' | 'off';
type Step = 'current' | 'create' | 'confirm';

export default function LockSetupScreen() {
  const router = useRouter();
  const { mode = 'new' } = useLocalSearchParams<{ mode?: Mode }>();
  const { enable, disable, submitPin } = useLock();

  // Changing or removing a PIN starts by proving you know the current one.
  const [step, setStep] = useState<Step>(mode === 'new' ? 'create' : 'current');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCurrent(pin: string) {
    setBusy(true);
    // submitPin also clears the failure counter on success, which is what we
    // want: proving the PIN here is as good as unlocking.
    const ok = await submitPin(pin);
    setBusy(false);
    if (!ok) {
      setError('That is not your current PIN.');
      return;
    }
    setError(null);
    if (mode === 'off') {
      await disable();
      router.back();
      return;
    }
    setStep('create');
  }

  function handleCreate(pin: string) {
    const problem = validatePin(pin);
    if (problem) {
      setError(describePinProblem(problem));
      return;
    }
    setFirst(pin);
    setError(null);
    setStep('confirm');
  }

  async function handleConfirm(pin: string) {
    if (pin !== first) {
      setError("Those didn't match — start again.");
      setFirst('');
      setStep('create');
      return;
    }
    setBusy(true);
    await enable(pin);
    setBusy(false);
    router.back();
  }

  const copy = {
    current: {
      title: mode === 'off' ? 'Confirm your PIN' : 'Enter your current PIN',
      subtitle: mode === 'off' ? 'Needed before the lock can be turned off.' : undefined,
    },
    create: {
      title: mode === 'new' ? 'Choose a PIN' : 'Choose a new PIN',
      subtitle: '4 to 8 digits. Pick something you will not forget — there is no way to reset it.',
    },
    confirm: { title: 'Enter it again', subtitle: 'Just to be sure.' },
  }[step];

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg }}>
        <PinPad
          title={copy.title}
          subtitle={copy.subtitle}
          error={error}
          disabled={busy}
          resetKey={step}
          submitLabel={step === 'confirm' ? '✓' : '→'}
          onSubmit={
            step === 'current' ? handleCurrent : step === 'create' ? handleCreate : handleConfirm
          }
        />
        <Txt
          variant="caption"
          tone="primary"
          style={{ textAlign: 'center', marginTop: spacing.xl }}
          onPress={() => router.back()}
        >
          Cancel
        </Txt>
      </View>
    </Screen>
  );
}
