import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ATTEMPTS_BEFORE_LOCKOUT,
  lockoutSeconds,
  remainingLockoutMs,
  shouldRelock,
  validatePin,
} from '../src/lib/lock.ts';

test('a reasonable PIN is accepted', () => {
  for (const pin of ['1938', '204815', '90210', '48261537']) {
    assert.equal(validatePin(pin), null, `expected ${pin} to be accepted`);
  }
});

test('PIN length is bounded at both ends', () => {
  assert.equal(validatePin('123'), 'too-short');
  assert.equal(validatePin(''), 'too-short');
  assert.equal(validatePin('123456789'), 'too-long');
});

test('non-digits are rejected', () => {
  assert.equal(validatePin('12a4'), 'not-digits');
  assert.equal(validatePin('12 4'), 'not-digits');
});

test('repeated digits and straight runs are rejected', () => {
  assert.equal(validatePin('1111'), 'too-simple');
  assert.equal(validatePin('000000'), 'too-simple');
  assert.equal(validatePin('1234'), 'too-simple');
  assert.equal(validatePin('4321'), 'too-simple');
  assert.equal(validatePin('456789'), 'too-simple');
});

test('a near-run is still allowed', () => {
  // Only a full arithmetic run of ±1 counts as too simple.
  assert.equal(validatePin('1235'), null);
  assert.equal(validatePin('1224'), null);
});

test('the keypad stays open until the attempt limit', () => {
  for (let attempts = 0; attempts < ATTEMPTS_BEFORE_LOCKOUT; attempts += 1) {
    assert.equal(lockoutSeconds(attempts), 0);
  }
  assert.equal(lockoutSeconds(ATTEMPTS_BEFORE_LOCKOUT), 30);
});

test('lockouts get longer and then hold at the top of the ladder', () => {
  const ladder = [5, 6, 7, 8, 9, 10, 20].map(lockoutSeconds);
  assert.deepEqual(ladder, [30, 60, 300, 900, 3600, 3600, 3600]);
});

test('remaining lockout counts down and never goes negative', () => {
  assert.equal(remainingLockoutMs(5, 1_000_000, 1_000_000), 30_000);
  assert.equal(remainingLockoutMs(5, 1_000_000, 1_010_000), 20_000);
  assert.equal(remainingLockoutMs(5, 1_000_000, 9_999_999), 0);
  assert.equal(remainingLockoutMs(2, 1_000_000, 1_000_000), 0);
  assert.equal(remainingLockoutMs(5, null, 1_000_000), 0);
});

test('a cold start always asks for the PIN', () => {
  assert.equal(shouldRelock(null, 5_000_000, 900), true);
});

test('"immediately" relocks however brief the trip away was', () => {
  assert.equal(shouldRelock(1_000_000, 1_000_050, 0), true);
});

test('a short trip away inside the grace period does not relock', () => {
  assert.equal(shouldRelock(1_000_000, 1_030_000, 60), false);
  assert.equal(shouldRelock(1_000_000, 1_060_000, 60), true);
});

test('a backwards clock jump locks rather than extending the grace period', () => {
  assert.equal(shouldRelock(5_000_000, 1_000_000, 900), true);
});
