/**
 * App-lock rules.
 *
 * This module is deliberately free of native imports so every rule below can
 * be tested directly. The parts that need the device — hashing the PIN,
 * reading the Keychain/Keystore, prompting for a fingerprint — live in
 * `src/storage/lock.ts`.
 *
 * What this lock is: a privacy screen that stops anyone holding your unlocked
 * phone from reading your finances. What it is not: protection against someone
 * who can extract the device's storage. That is what the phone's own disk
 * encryption is for, and a 4-6 digit PIN could never add to it.
 */

/** Allowed PIN lengths. Six is the default; four is offered for speed. */
export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 8;

/** Wrong attempts allowed before the keypad starts timing out. */
export const ATTEMPTS_BEFORE_LOCKOUT = 5;

/** How long each successive lockout lasts, in seconds. */
const LOCKOUT_LADDER_SECONDS = [30, 60, 300, 900, 3600];

export type PinProblem = 'too-short' | 'too-long' | 'not-digits' | 'too-simple';

/**
 * Reject PINs that are trivially guessable. Repeated digits and straight
 * runs are the first things anyone tries, so they are worth blocking even
 * though it costs a little convenience.
 */
export function validatePin(pin: string): PinProblem | null {
  if (pin.length < MIN_PIN_LENGTH) return 'too-short';
  if (pin.length > MAX_PIN_LENGTH) return 'too-long';
  if (!/^\d+$/.test(pin)) return 'not-digits';

  const digits = [...pin].map(Number);
  const allSame = digits.every((d) => d === digits[0]);
  if (allSame) return 'too-simple';

  const step = digits[1] - digits[0];
  if ((step === 1 || step === -1) && digits.every((d, i) => i === 0 || d - digits[i - 1] === step)) {
    return 'too-simple';
  }
  return null;
}

export function describePinProblem(problem: PinProblem): string {
  switch (problem) {
    case 'too-short':
      return `Use at least ${MIN_PIN_LENGTH} digits.`;
    case 'too-long':
      return `Use at most ${MAX_PIN_LENGTH} digits.`;
    case 'not-digits':
      return 'Digits only.';
    case 'too-simple':
      return 'That one is too easy to guess — avoid repeats like 1111 or runs like 1234.';
  }
}

/**
 * Seconds of enforced wait after `failedAttempts` wrong entries. Zero means
 * the keypad is open. The ladder climbs and then holds at its last step.
 */
export function lockoutSeconds(failedAttempts: number): number {
  const over = failedAttempts - ATTEMPTS_BEFORE_LOCKOUT;
  if (over < 0) return 0;
  return LOCKOUT_LADDER_SECONDS[Math.min(over, LOCKOUT_LADDER_SECONDS.length - 1)];
}

/** Milliseconds still to wait, given when the last failure happened. */
export function remainingLockoutMs(
  failedAttempts: number,
  lastFailureAt: number | null,
  now: number
): number {
  const window = lockoutSeconds(failedAttempts) * 1000;
  if (window === 0 || lastFailureAt === null) return 0;
  return Math.max(0, lastFailureAt + window - now);
}

/** Auto-lock delays offered in settings. */
export const AUTO_LOCK_CHOICES = [
  { seconds: 0, label: 'Immediately' },
  { seconds: 60, label: 'After 1 min' },
  { seconds: 300, label: 'After 5 min' },
  { seconds: 900, label: 'After 15 min' },
] as const;

/**
 * Whether returning to the app should demand the PIN again.
 *
 * `backgroundedAt` of null means the app was never sent to the background in
 * this run — a cold start — which always locks.
 */
export function shouldRelock(
  backgroundedAt: number | null,
  now: number,
  autoLockSeconds: number
): boolean {
  if (backgroundedAt === null) return true;
  if (autoLockSeconds <= 0) return true;
  // A clock that jumped backwards must not extend the grace period.
  const elapsed = now - backgroundedAt;
  if (elapsed < 0) return true;
  return elapsed >= autoLockSeconds * 1000;
}
