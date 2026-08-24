# Pocketbook — an ad-free budget tracker

A personal budget tracker built with React Native (Expo) for iOS and Android.
No advertising, no accounts, no analytics, and no network calls: every figure
you enter is stored on the device and nowhere else.

## What it does

- **Track money in and out** — expenses and income with categories, dates and
  notes, grouped by month and searchable.
- **Budget per category** — a standing monthly limit plus one-off overrides for
  a single month, with progress, remaining amount and a safe-daily-spend figure.
- **Recurring bills and income** — weekly through yearly, with rules that either
  post themselves or wait for you to confirm, plus local reminders before a bill
  falls due.
- **Reports** — spend by category (donut plus a ranked list carrying the exact
  figures), income against spending over the last six periods, a running balance
  for the period, and the biggest single expenses.
- **Savings goals** — targets with optional deadlines, contribution history and
  the monthly amount needed to arrive on time.
- **Alarms and calendar** — any recurring bill can ring like an alarm (sound,
  vibration, breaking through Do Not Disturb) and can be mirrored into a
  calendar on the device as a repeating event with its own alert, so the
  reminder survives even if the app is removed.
- **Any country** — 191 country presets seed the home currency and the local
  consumption-tax rate (VAT / GST / IVA / sales tax), all editable.
- **Currency conversion** — a converter with a rate table you can type in
  yourself, and the option to enter a transaction in a foreign currency; it is
  stored converted so every total still adds up, with the original kept
  alongside.
- **Tax helper** — splits any amount into net and tax at your rate, in whichever
  direction your country quotes prices.
- **App lock** — an optional 4-8 digit PIN, plus Face ID or fingerprint where the
  device supports it, with an auto-lock delay and an escalating wait after
  repeated wrong entries.
- **Your data stays yours** — export a full JSON backup or a CSV of transactions
  at any time, restore a backup on any device, or erase everything.

Amounts are stored as integer minor units, so no figure ever drifts through
floating-point rounding — and the scale follows the currency, so yen are not
silently multiplied by a hundred nor Kuwaiti dinars divided by ten. Budget periods can start on any day of the
month, which matters if your month effectively starts on payday.

## Running it

Node 22.18 or newer is required — the test suite is TypeScript run directly
through `node --test`, which relies on built-in type stripping.

```bash
npm install
npm start           # then scan the QR code with Expo Go, or press i / a
```

Other targets:

```bash
npm run android     # Android emulator or device
npm run ios         # iOS simulator (macOS only)
npm run web         # the same app in a browser
```

Checks — the same three CI runs on every pull request:

```bash
npm run typecheck   # TypeScript, app and tests
npm test            # unit tests for the money, date, budget and rule logic
npx expo export --platform android --output-dir /tmp/export   # bundles cleanly
```

Building installable binaries needs Expo's build tooling (`eas build`) or a
local Xcode / Android Studio setup — this repository holds the app source only.

## Layout

```
app/                    screens and routing (expo-router, file based)
  (tabs)/               Home, Activity, Budgets, Reports, More
  transaction/[id]      add and edit a transaction
  recurring/            recurring rules
  goals/                savings goals
  converter.tsx         currency converter and rate table
  lock-setup.tsx        PIN setup, change and removal
src/
  lib/                  pure logic: money, dates, budgets, recurring, goals,
                        reports, currency, tax, countries, lock — plus the
                        device-facing reminders, calendar, rates and backup
  state/                reducer and the app-wide store
  storage/              AsyncStorage persistence, validation, import/export
  components/           shared UI and the charts (react-native-svg)
  theme/                colour, spacing and type scales
tools/                  build-time scripts (icon generation)
tests/                  unit tests for everything under src/lib and src/state
```

Every app icon — iOS, the Android adaptive layers, the themed monochrome
layer, splash and favicon — is generated from a single SVG mark by
`tools/generate-icons.mjs`, so changing the artwork means editing one file
rather than re-exporting six PNGs by hand.

Everything under `src/lib` and `src/state/reducer.ts` is free of React and of
React Native imports, which is what lets the whole rule set — month-end
clamping, budget pacing, recurring schedules, import validation — be tested
directly with `node --test`.

## Privacy

There is no ad SDK, no crash reporter, no analytics and no identifier of any
kind, and nothing is ever uploaded.

By default the app makes **no network requests at all**. One optional feature
changes that, and only that: switching on online exchange rates lets the
converter ask a public rates service (`open.er-api.com`) for the day's rates
when you tap refresh. The request contains no personal data — it names a
currency and nothing else — though the service necessarily sees the device's IP
address. The toggle is off until you turn it on, the settings screen spells this
out before you do, and with it off every rate is typed in by hand and the app is
completely offline. All of it lives in `src/lib/rates.ts`, the only file in the
project that calls `fetch`.

Calendar access, when granted, is used solely to write and update bill events in
the calendar you pick.

Because nothing is synced, uninstalling the app deletes your data — export a
backup before switching devices.

The app lock is a privacy screen, not a vault: it stops someone holding your
unlocked phone from reading your finances. Protection against someone who can
extract the device's storage comes from the phone's own disk encryption, which
a short numeric PIN could not meaningfully add to. The PIN is stored as a
salted, repeatedly-hashed digest in the iOS Keychain / Android Keystore — never
in the app's data, and so never inside a backup file you might share.
