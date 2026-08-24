/**
 * The device-facing half of the app lock: the PIN hash, the Keychain /
 * Keystore entry that holds it, and the biometric prompt.
 *
 * The PIN hash lives in `expo-secure-store` — iOS Keychain, Android Keystore —
 * and deliberately NOT in the app's normal data. Two reasons: a JSON backup
 * you email to yourself should never carry your credential, and restoring an
 * old backup should never quietly change or remove the lock on your phone.
 */

import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const LOCK_KEY = 'pocketbook.lock.v1';

/**
 * Rounds of SHA-256 over the salted PIN.
 *
 * A 4-8 digit PIN is a small search space, so this is about making an offline
 * guessing run cost something rather than pretending to be a KDF. It is tuned
 * to stay under roughly a tenth of a second on the phones this targets, since
 * it runs on every unlock.
 */
const HASH_ROUNDS = 2048;

const SALT_BYTES = 16;

export type LockConfig = {
  /** True once a PIN has been set. */
  enabled: boolean;
  /** Offer fingerprint / Face ID as well as the PIN. */
  biometrics: boolean;
  /** Grace period before returning to the app demands the PIN again. */
  autoLockSeconds: number;
};

type StoredLock = LockConfig & { hash: string; salt: string };

export const DEFAULT_LOCK: LockConfig = { enabled: false, biometrics: false, autoLockSeconds: 60 };

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

async function hashPin(pin: string, salt: string): Promise<string> {
  let digest = `${salt}:${pin}`;
  for (let round = 0; round < HASH_ROUNDS; round += 1) {
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, digest);
  }
  return digest;
}

/** Constant-time-ish comparison, so a wrong PIN can't be timed digit by digit. */
function equalHashes(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function readStored(): Promise<StoredLock | null> {
  try {
    const raw = await SecureStore.getItemAsync(LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLock>;
    if (typeof parsed.hash !== 'string' || typeof parsed.salt !== 'string') return null;
    return {
      hash: parsed.hash,
      salt: parsed.salt,
      enabled: true,
      biometrics: parsed.biometrics === true,
      autoLockSeconds:
        typeof parsed.autoLockSeconds === 'number' ? parsed.autoLockSeconds : DEFAULT_LOCK.autoLockSeconds,
    };
  } catch {
    // An unreadable entry is treated as "no lock" rather than locking the
    // owner out of their own ledger.
    return null;
  }
}

async function writeStored(value: StoredLock): Promise<void> {
  await SecureStore.setItemAsync(LOCK_KEY, JSON.stringify(value), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadLockConfig(): Promise<LockConfig> {
  const stored = await readStored();
  if (!stored) return { ...DEFAULT_LOCK };
  return { enabled: true, biometrics: stored.biometrics, autoLockSeconds: stored.autoLockSeconds };
}

/** Whether the secure keystore can be used at all on this device. */
export async function isSecureStorageAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function setPin(pin: string, config?: Partial<LockConfig>): Promise<void> {
  const existing = await readStored();
  const salt = toHex(await Crypto.getRandomBytesAsync(SALT_BYTES));
  const hash = await hashPin(pin, salt);
  await writeStored({
    hash,
    salt,
    enabled: true,
    biometrics: config?.biometrics ?? existing?.biometrics ?? false,
    autoLockSeconds: config?.autoLockSeconds ?? existing?.autoLockSeconds ?? DEFAULT_LOCK.autoLockSeconds,
  });
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await readStored();
  if (!stored) return false;
  return equalHashes(await hashPin(pin, stored.salt), stored.hash);
}

export async function updateLockConfig(patch: Partial<LockConfig>): Promise<void> {
  const stored = await readStored();
  if (!stored) return;
  await writeStored({ ...stored, ...patch, enabled: true });
}

export async function disableLock(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(LOCK_KEY);
  } catch {
    // Nothing stored; the lock is already off.
  }
}

export type BiometricStatus = {
  /** Hardware is present and at least one fingerprint or face is enrolled. */
  usable: boolean;
  /** What to call it on this device: "Face ID", "Fingerprint", "Biometrics". */
  label: string;
};

export async function biometricStatus(): Promise<BiometricStatus> {
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const facial = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const fingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const label = facial ? 'Face ID' : fingerprint ? 'Fingerprint' : 'Biometrics';
    return { usable: hasHardware && enrolled, label };
  } catch {
    return { usable: false, label: 'Biometrics' };
  }
}

/** Show the system biometric prompt. Returns false on cancel or failure. */
export async function promptBiometric(label: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Unlock Pocketbook with ${label}`,
      fallbackLabel: 'Use PIN',
      // The PIN keypad is already on screen behind the prompt, so sending the
      // user to the OS passcode screen would only add a step.
      disableDeviceFallback: true,
    });
    return result.success;
  } catch {
    return false;
  }
}
