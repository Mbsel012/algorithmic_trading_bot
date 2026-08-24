/**
 * App-lock state: whether the ledger is currently hidden behind the PIN, and
 * the actions that change that.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { shouldRelock } from '../lib/lock.ts';
import {
  DEFAULT_LOCK,
  biometricStatus,
  disableLock,
  loadLockConfig,
  promptBiometric,
  setPin as persistPin,
  updateLockConfig,
  verifyPin,
  type BiometricStatus,
  type LockConfig,
} from '../storage/lock.ts';

/**
 * Failed attempts are persisted so that force-quitting the app cannot be used
 * to wipe a lockout and keep guessing.
 */
const ATTEMPTS_KEY = 'pocketbook.lockattempts.v1';

type Attempts = { failed: number; lastFailureAt: number | null };

type Ctx = {
  ready: boolean;
  config: LockConfig;
  locked: boolean;
  attempts: Attempts;
  biometric: BiometricStatus;
  submitPin: (pin: string) => Promise<boolean>;
  tryBiometric: () => Promise<boolean>;
  enable: (pin: string) => Promise<void>;
  changePin: (pin: string) => Promise<void>;
  disable: () => Promise<void>;
  update: (patch: Partial<LockConfig>) => Promise<void>;
  lockNow: () => void;
};

const LockContext = createContext<Ctx | null>(null);

export function LockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<LockConfig>(DEFAULT_LOCK);
  const [locked, setLocked] = useState(false);
  const [attempts, setAttempts] = useState<Attempts>({ failed: 0, lastFailureAt: null });
  const [biometric, setBiometric] = useState<BiometricStatus>({ usable: false, label: 'Biometrics' });

  const backgroundedAt = useRef<number | null>(null);
  // Read inside the AppState listener, which is registered once.
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stored, storedAttempts, bio] = await Promise.all([
        loadLockConfig(),
        AsyncStorage.getItem(ATTEMPTS_KEY),
        biometricStatus(),
      ]);
      if (cancelled) return;
      setConfig(stored);
      setBiometric(bio);
      // A cold start always starts locked when a PIN is set.
      setLocked(stored.enabled);
      if (storedAttempts) {
        try {
          const parsed = JSON.parse(storedAttempts) as Attempts;
          setAttempts({
            failed: typeof parsed.failed === 'number' ? parsed.failed : 0,
            lastFailureAt: typeof parsed.lastFailureAt === 'number' ? parsed.lastFailureAt : null,
          });
        } catch {
          // Ignore a corrupt counter — it only ever costs the user leniency.
        }
      }
      setReady(true);
    })().catch(() => setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const current = configRef.current;
      if (next === 'active') {
        if (current.enabled && shouldRelock(backgroundedAt.current, Date.now(), current.autoLockSeconds)) {
          setLocked(true);
        }
        backgroundedAt.current = null;
      } else {
        backgroundedAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  const recordAttempts = useCallback(async (next: Attempts) => {
    setAttempts(next);
    try {
      await AsyncStorage.setItem(ATTEMPTS_KEY, JSON.stringify(next));
    } catch {
      // Not being able to persist the counter must not block unlocking.
    }
  }, []);

  const submitPin = useCallback(
    async (pin: string) => {
      const ok = await verifyPin(pin);
      if (ok) {
        await recordAttempts({ failed: 0, lastFailureAt: null });
        setLocked(false);
        return true;
      }
      await recordAttempts({ failed: attempts.failed + 1, lastFailureAt: Date.now() });
      return false;
    },
    [attempts.failed, recordAttempts]
  );

  const tryBiometric = useCallback(async () => {
    if (!config.biometrics || !biometric.usable) return false;
    const ok = await promptBiometric(biometric.label);
    if (ok) {
      await recordAttempts({ failed: 0, lastFailureAt: null });
      setLocked(false);
    }
    return ok;
  }, [config.biometrics, biometric, recordAttempts]);

  const enable = useCallback(async (pin: string) => {
    await persistPin(pin);
    setConfig(await loadLockConfig());
  }, []);

  const changePin = enable;

  const disable = useCallback(async () => {
    await disableLock();
    setConfig({ ...DEFAULT_LOCK });
    setLocked(false);
    await AsyncStorage.removeItem(ATTEMPTS_KEY).catch(() => undefined);
    setAttempts({ failed: 0, lastFailureAt: null });
  }, []);

  const update = useCallback(async (patch: Partial<LockConfig>) => {
    await updateLockConfig(patch);
    setConfig(await loadLockConfig());
  }, []);

  const lockNow = useCallback(() => setLocked(true), []);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      config,
      locked,
      attempts,
      biometric,
      submitPin,
      tryBiometric,
      enable,
      changePin,
      disable,
      update,
      lockNow,
    }),
    [ready, config, locked, attempts, biometric, submitPin, tryBiometric, enable, changePin, disable, update, lockNow]
  );

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export function useLock(): Ctx {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used inside <LockProvider>');
  return ctx;
}
