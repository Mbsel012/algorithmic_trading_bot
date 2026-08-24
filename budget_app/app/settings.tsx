import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';

import { exportBackup, exportCSV, importBackup } from '../src/lib/backup.ts';
import { COMMON_CURRENCIES, createInitialData } from '../src/lib/defaults.ts';
import { pad2 } from '../src/lib/dates.ts';
import { createId } from '../src/lib/id.ts';
import { Field } from '../src/components/fields.tsx';
import {
  Body,
  Button,
  Card,
  Chip,
  Divider,
  Row,
  Screen,
  Segmented,
  Spacer,
  Txt,
} from '../src/components/ui.tsx';
import { clearData } from '../src/storage/repository.ts';
import { useApp } from '../src/state/store.tsx';
import { spacing } from '../src/theme/index.ts';
import type { ThemePreference } from '../src/types.ts';

const MONTH_START_CHOICES = [1, 5, 10, 15, 20, 25, 28];
const REMINDER_HOURS = [7, 8, 9, 12, 18, 20];

export default function SettingsScreen() {
  const router = useRouter();
  const { data, updateSettings, dispatch, theme } = useApp();
  const [busy, setBusy] = useState<string | null>(null);

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
    </Screen>
  );
}
