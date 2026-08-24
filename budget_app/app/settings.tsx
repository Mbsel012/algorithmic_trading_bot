import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';

import { exportBackup, exportCSV, importBackup } from '../src/lib/backup.ts';
import { hasCalendarPermission, listWritableCalendars, requestCalendarPermission, syncCalendar, type WritableCalendar } from '../src/lib/calendar.ts';
import { findCountry, searchCountries } from '../src/lib/countries.ts';
import { rebase } from '../src/lib/currency.ts';
import { AUTO_LOCK_CHOICES } from '../src/lib/lock.ts';
import { formatRate } from '../src/lib/tax.ts';
import { COMMON_CURRENCIES, createInitialData } from '../src/lib/defaults.ts';
import { pad2 } from '../src/lib/dates.ts';
import { createId } from '../src/lib/id.ts';
import { Field, TextField } from '../src/components/fields.tsx';
import {
  Body,
  Button,
  Card,
  Chip,
  Divider,
  ListItem,
  Row,
  Screen,
  Segmented,
  Sheet,
  Spacer,
  Txt,
} from '../src/components/ui.tsx';
import { isSecureStorageAvailable } from '../src/storage/lock.ts';
import { clearData } from '../src/storage/repository.ts';
import { useLock } from '../src/state/lockContext.tsx';
import { useApp } from '../src/state/store.tsx';
import { spacing } from '../src/theme/index.ts';
import type { TaxMode, ThemePreference } from '../src/types.ts';

const MONTH_START_CHOICES = [1, 5, 10, 15, 20, 25, 28];
const REMINDER_HOURS = [7, 8, 9, 12, 18, 20];

export default function SettingsScreen() {
  const router = useRouter();
  const { data, updateSettings, dispatch, theme } = useApp();
  const lock = useLock();
  const [busy, setBusy] = useState<string | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [calendars, setCalendars] = useState<WritableCalendar[]>([]);
  const [taxDraft, setTaxDraft] = useState(String(data.settings.taxRate));

  const country = findCountry(data.settings.countryCode);

  /**
   * Picking a country seeds the currency and tax rate. The rate table is
   * rebased at the same time so existing rates keep converting correctly
   * against the new home currency.
   */
  function applyCountry(code: string) {
    const preset = findCountry(code);
    if (!preset) return;
    setCountryOpen(false);
    setTaxDraft(String(preset.taxRate));
    updateSettings({
      countryCode: preset.code,
      currency: preset.currency,
      taxRate: preset.taxRate,
      taxLabel: preset.taxLabel,
    });
    if (preset.currency !== data.rates.base) {
      dispatch({ type: 'rates/set', table: rebase(data.rates, preset.currency) });
    }
  }

  function commitTaxRate() {
    const value = Number(taxDraft.replace(/,/g, '.'));
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setTaxDraft(String(data.settings.taxRate));
      return;
    }
    updateSettings({ taxRate: value });
  }

  async function toggleCalendar(next: boolean) {
    if (!next) {
      updateSettings({ calendarEnabled: false });
      // Clearing the events is what "off" should mean.
      await syncCalendar(data.recurring, { ...data.settings, calendarEnabled: false });
      return;
    }
    const granted = (await hasCalendarPermission()) || (await requestCalendarPermission());
    if (!granted) {
      Alert.alert(
        'Calendar access needed',
        'Pocketbook needs permission to add your bills to a calendar. You can grant it in your device settings.'
      );
      return;
    }
    setCalendars(await listWritableCalendars());
    updateSettings({ calendarEnabled: true });
  }

  function toggleOnlineRates(next: boolean) {
    if (!next) {
      updateSettings({ onlineRatesEnabled: false });
      return;
    }
    Alert.alert(
      'Allow one online request?',
      'This is the only thing in the app that uses the internet. It asks a public rates service for today\'s exchange rates and sends none of your data — though that service will see your device\'s IP address, as any website would. Everything else stays offline.',
      [
        { text: 'Keep it offline', style: 'cancel' },
        { text: 'Allow', onPress: () => updateSettings({ onlineRatesEnabled: true }) },
      ]
    );
  }

  async function startLockSetup() {
    if (!(await isSecureStorageAvailable())) {
      Alert.alert(
        'Secure storage unavailable',
        "This device won't let the app store a PIN in its secure keychain, so the lock can't be turned on here."
      );
      return;
    }
    router.push('/lock-setup?mode=new');
  }

  async function runExport(kind: 'json' | 'csv') {
    setBusy(kind);
    const result = kind === 'json' ? await exportBackup(data) : await exportCSV(data);
    setBusy(null);
    if (!result.ok) Alert.alert('Export failed', result.error);
  }

  async function runImport() {
    setBusy('import');
    const result = await importBackup();
    setBusy(null);
    if (!result.ok) {
      if (result.error !== 'cancelled') Alert.alert('Import failed', result.error);
      return;
    }
    const counts = `${result.data.transactions.length} transactions, ${result.data.categories.length} categories`;
    Alert.alert('Replace everything?', `This backup holds ${counts}. Your current data will be replaced.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Replace',
        style: 'destructive',
        onPress: () => dispatch({ type: 'replaceAll', data: result.data }),
      },
    ]);
  }

  function eraseEverything() {
    Alert.alert('Erase all data?', 'Every transaction, budget, goal and rule on this device is deleted. Export a backup first if you might want it back.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase',
        style: 'destructive',
        onPress: async () => {
          await clearData();
          dispatch({ type: 'replaceAll', data: createInitialData(() => createId('cat')) });
        },
      },
    ]);
  }

  return (
    <Screen edges={['bottom']}>
      <Body>
        <Card>
          <Field label="Currency" hint="Used for every amount in the app.">
            <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
              {COMMON_CURRENCIES.map((currency) => (
                <Chip
                  key={currency.code}
                  label={currency.code}
                  selected={data.settings.currency === currency.code}
                  onPress={() => updateSettings({ currency: currency.code })}
                />
              ))}
            </Row>
          </Field>

          <Field label="Appearance">
            <Segmented
              value={data.settings.theme}
              onChange={(next: ThemePreference) => updateSettings({ theme: next })}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </Field>

          <Field
            label="Budget period starts on"
            hint="Set this to payday if your month doesn't start on the 1st."
          >
            <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
              {MONTH_START_CHOICES.map((day) => (
                <Chip
                  key={day}
                  label={day === 1 ? '1st' : `${day}th`}
                  selected={data.settings.monthStartDay === day}
                  onPress={() => updateSettings({ monthStartDay: day })}
                />
              ))}
            </Row>
          </Field>
        </Card>

        <Spacer />

        <Card>
          <Row justify="space-between">
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Txt variant="body">Bill reminders</Txt>
              <Txt variant="caption" tone="faint">
                Local notifications only — nothing leaves this device.
              </Txt>
            </View>
            <Switch
              value={data.settings.remindersEnabled}
              onValueChange={(next) => updateSettings({ remindersEnabled: next })}
              trackColor={{ true: theme.colors.primary, false: theme.colors.track }}
            />
          </Row>
          {data.settings.remindersEnabled ? (
            <>
              <Spacer size={spacing.md} />
              <Txt variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>
                Remind me at
              </Txt>
              <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
                {REMINDER_HOURS.map((hour) => (
                  <Chip
                    key={hour}
                    label={`${pad2(hour)}:00`}
                    selected={data.settings.reminderHour === hour}
                    onPress={() => updateSettings({ reminderHour: hour, reminderMinute: 0 })}
                  />
                ))}
              </Row>
            </>
          ) : null}
        </Card>

        <Spacer />

        <Card>
          <Row justify="space-between">
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Txt variant="heading">App lock</Txt>
              <Txt variant="caption" tone="muted" style={{ marginTop: 4 }}>
                {lock.config.enabled
                  ? 'A PIN is required to open the app.'
                  : 'Ask for a PIN before showing your finances.'}
              </Txt>
            </View>
            <Switch
              value={lock.config.enabled}
              onValueChange={(next) =>
                next ? void startLockSetup() : router.push('/lock-setup?mode=off')
              }
              trackColor={{ true: theme.colors.primary, false: theme.colors.track }}
            />
          </Row>

          {lock.config.enabled ? (
            <>
              <Spacer size={spacing.lg} />
              <Divider />
              <Spacer size={spacing.lg} />

              {lock.biometric.usable ? (
                <>
                  <Row justify="space-between">
                    <View style={{ flex: 1, paddingRight: spacing.md }}>
                      <Txt variant="body">Unlock with {lock.biometric.label}</Txt>
                      <Txt variant="caption" tone="faint">
                        The PIN still works as a fallback.
                      </Txt>
                    </View>
                    <Switch
                      value={lock.config.biometrics}
                      onValueChange={(next) => void lock.update({ biometrics: next })}
                      trackColor={{ true: theme.colors.primary, false: theme.colors.track }}
                    />
                  </Row>
                  <Spacer size={spacing.lg} />
                </>
              ) : null}

              <Txt variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>
                Lock again
              </Txt>
              <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
                {AUTO_LOCK_CHOICES.map((choice) => (
                  <Chip
                    key={choice.seconds}
                    label={choice.label}
                    selected={lock.config.autoLockSeconds === choice.seconds}
                    onPress={() => void lock.update({ autoLockSeconds: choice.seconds })}
                  />
                ))}
              </Row>
              <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm }}>
                How long the app may sit in the background before it asks again.
              </Txt>

              <Spacer size={spacing.lg} />
              <Button
                label="Change PIN"
                variant="secondary"
                onPress={() => router.push('/lock-setup?mode=change')}
              />
              <Spacer size={spacing.sm} />
              <Button label="Lock now" variant="secondary" onPress={lock.lockNow} />
            </>
          ) : null}
        </Card>

        <Spacer />

        <Card>
          <Txt variant="heading">Country & tax</Txt>
          <Txt variant="caption" tone="muted" style={{ marginTop: 4, marginBottom: spacing.lg }}>
            Sets your currency and the local sales-tax rate used by the tax
            helper when you add a transaction.
          </Txt>

          <Field label="Country">
            <Pressable
              onPress={() => setCountryOpen(true)}
              style={{
                backgroundColor: theme.colors.surfaceAlt,
                borderRadius: 12,
                paddingHorizontal: spacing.md,
                paddingVertical: 14,
              }}
            >
              <Txt tone={country ? 'default' : 'faint'}>
                {country ? `${country.name} · ${country.currency}` : 'Not set — tap to choose'}
              </Txt>
            </Pressable>
          </Field>

          <Field
            label={`${data.settings.taxLabel} rate`}
            hint={
              country?.note ??
              'A starting point only — rates change, and reduced rates apply to many goods. Edit it freely.'
            }
          >
            <Row gap={spacing.sm}>
              <View style={{ flex: 1 }}>
                <TextField
                  value={taxDraft}
                  onChangeText={(next) => setTaxDraft(next.replace(/[^0-9.,]/g, ''))}
                  placeholder="0"
                  keyboardType="decimal-pad"
                />
              </View>
              <Button label="Set" variant="secondary" onPress={commitTaxRate} />
            </Row>
          </Field>
          <Txt variant="caption" tone="faint" style={{ marginTop: -spacing.md, marginBottom: spacing.lg }}>
            Currently {formatRate(data.settings.taxRate)}.
          </Txt>

          <Field label="Prices around you usually">
            <Segmented
              value={data.settings.taxMode}
              onChange={(next: TaxMode) => updateSettings({ taxMode: next })}
              options={[
                { value: 'inclusive', label: 'Include tax' },
                { value: 'exclusive', label: 'Add tax at till' },
              ]}
            />
          </Field>
        </Card>

        <Spacer />

        <Card>
          <Row justify="space-between">
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Txt variant="heading">Bills in your calendar</Txt>
              <Txt variant="caption" tone="muted" style={{ marginTop: 4 }}>
                Adds each recurring bill to a calendar on this device, with its own
                alert. Where that calendar syncs afterwards is your account's
                setting, not something this app arranges.
              </Txt>
            </View>
            <Switch
              value={data.settings.calendarEnabled}
              onValueChange={(next) => void toggleCalendar(next)}
              trackColor={{ true: theme.colors.primary, false: theme.colors.track }}
            />
          </Row>
          {data.settings.calendarEnabled ? (
            <>
              <Spacer size={spacing.lg} />
              <Txt variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>
                Write bills into
              </Txt>
              <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
                <Chip
                  label="Its own calendar"
                  selected={data.settings.calendarId === null}
                  onPress={() => updateSettings({ calendarId: null })}
                />
                {calendars.map((calendar) => (
                  <Chip
                    key={calendar.id}
                    label={calendar.title}
                    selected={data.settings.calendarId === calendar.id}
                    onPress={() => updateSettings({ calendarId: calendar.id })}
                  />
                ))}
              </Row>
              <Spacer size={spacing.md} />
              <Button
                label={busy === 'calendar' ? 'Syncing…' : 'Sync bills to calendar now'}
                variant="secondary"
                loading={busy === 'calendar'}
                onPress={async () => {
                  setBusy('calendar');
                  const result = await syncCalendar(data.recurring, data.settings);
                  setBusy(null);
                  Alert.alert(
                    result.error ? 'Could not sync' : 'Calendar updated',
                    result.error === 'no-permission'
                      ? 'Calendar permission was not granted.'
                      : result.error === 'no-calendar'
                        ? 'No writable calendar was found on this device.'
                        : `${result.created} added, ${result.updated} updated, ${result.removed} removed.`
                  );
                }}
              />
              <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm }}>
                Only bills with "Add to my calendar" switched on are included.
              </Txt>
            </>
          ) : null}
        </Card>

        <Spacer />

        <Card>
          <Row justify="space-between">
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Txt variant="heading">Online exchange rates</Txt>
              <Txt variant="caption" tone="muted" style={{ marginTop: 4 }}>
                {data.settings.onlineRatesEnabled
                  ? 'The converter can fetch rates. This is the only feature that uses the internet.'
                  : 'Off — the app makes no network requests at all. Rates are typed in by hand.'}
              </Txt>
            </View>
            <Switch
              value={data.settings.onlineRatesEnabled}
              onValueChange={toggleOnlineRates}
              trackColor={{ true: theme.colors.primary, false: theme.colors.track }}
            />
          </Row>
          <Spacer size={spacing.md} />
          <Button
            label="Open the converter"
            variant="secondary"
            onPress={() => router.push('/converter')}
          />
        </Card>

        <Spacer />

        <Card>
          <Txt variant="heading">Your data</Txt>
          <Txt variant="caption" tone="muted" style={{ marginTop: 4, marginBottom: spacing.lg }}>
            Everything lives on this device. Export a backup before changing phones — there is no cloud copy.
          </Txt>
          <Button
            label={busy === 'json' ? 'Preparing…' : 'Export backup (JSON)'}
            variant="secondary"
            onPress={() => runExport('json')}
            loading={busy === 'json'}
          />
          <Spacer size={spacing.sm} />
          <Button
            label={busy === 'csv' ? 'Preparing…' : 'Export transactions (CSV)'}
            variant="secondary"
            onPress={() => runExport('csv')}
            loading={busy === 'csv'}
          />
          <Spacer size={spacing.sm} />
          <Button
            label={busy === 'import' ? 'Reading…' : 'Restore from backup'}
            variant="secondary"
            onPress={runImport}
            loading={busy === 'import'}
          />
          <Spacer size={spacing.lg} />
          <Divider />
          <Spacer size={spacing.lg} />
          <Button label="Erase all data" variant="danger" onPress={eraseEverything} />
        </Card>

        <Spacer />

        <Pressable onPress={() => router.push('/about')}>
          <Card>
            <Row justify="space-between">
              <Txt variant="body">About & privacy</Txt>
              <Txt variant="heading" tone="faint">
                ›
              </Txt>
            </Row>
          </Card>
        </Pressable>
      </Body>

      <Sheet visible={countryOpen} onClose={() => setCountryOpen(false)} title="Choose your country">
        <TextField value={countryQuery} onChangeText={setCountryQuery} placeholder="Search 190+ countries" />
        <Spacer size={spacing.md} />
        {searchCountries(countryQuery)
          .slice(0, 40)
          .map((preset) => (
            <ListItem
              key={preset.code}
              title={preset.name}
              subtitle={`${preset.currency} · ${preset.taxLabel} ${formatRate(preset.taxRate)}`}
              right={
                data.settings.countryCode === preset.code ? (
                  <Txt variant="caption" tone="primary">
                    ✓
                  </Txt>
                ) : undefined
              }
              onPress={() => applyCountry(preset.code)}
            />
          ))}
      </Sheet>
    </Screen>
  );
}
