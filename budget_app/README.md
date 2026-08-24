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
- **Your data stays yours** — export a full JSON backup or a CSV of transactions
  at any time, restore a backup on any device, or erase everything.

Amounts are stored as integer minor units (cents), so no figure ever drifts
through floating-point rounding. Budget periods can start on any day of the
month, which matters if your month effectively starts on payday.

## Running it

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

Checks:

```bash
npm test            # unit tests for the money, date, budget and rule logic
npm run typecheck   # TypeScript, app and tests
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
src/
  lib/                  pure logic: money, dates, budgets, recurring, goals,
                        reports, reminders, backup
  state/                reducer and the app-wide store
  storage/              AsyncStorage persistence, validation, import/export
  components/           shared UI and the charts (react-native-svg)
  theme/                colour, spacing and type scales
tests/                  unit tests for everything under src/lib and src/state
```

Everything under `src/lib` and `src/state/reducer.ts` is free of React and of
React Native imports, which is what lets the whole rule set — month-end
clamping, budget pacing, recurring schedules, import validation — be tested
directly with `node --test`.

## Privacy

The app makes no network requests. There is no ad SDK, no crash reporter, no
analytics and no identifier of any kind. Because nothing is synced, uninstalling
the app deletes your data — export a backup before switching devices.
