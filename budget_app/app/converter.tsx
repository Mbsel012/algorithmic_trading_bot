import React, { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import {
  availableCurrencies,
  crossRate,
  convert,
  describeAge,
  isStale,
  isValidCode,
  normaliseCode,
  removeRate,
  setRate,
} from '../src/lib/currency.ts';
import { currenciesFromCountries } from '../src/lib/countries.ts';
import { formatMoney, parseAmount, toDecimalString } from '../src/lib/money.ts';
import { fetchRates } from '../src/lib/rates.ts';
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
  Sheet,
  Spacer,
  Txt,
} from '../src/components/ui.tsx';
import { useApp } from '../src/state/store.tsx';
import { spacing } from '../src/theme/index.ts';

export default function ConverterScreen() {
  const { data, dispatch, theme } = useApp();
  const rates = data.rates;
  const home = data.settings.currency;

  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState(home);
  const [to, setTo] = useState(() => availableCurrencies(rates).find((c) => c !== home) ?? 'EUR');
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState('');
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);

  const parsed = parseAmount(amount || '0', from) ?? 0;
  const converted = convert(parsed, from, to, rates);
  const pairRate = crossRate(from, to, rates);

  const knownCodes = useMemo(() => availableCurrencies(rates), [rates]);
  const allCodes = useMemo(() => {
    const set = new Set([...knownCodes, ...currenciesFromCountries(), home]);
    return [...set].sort();
  }, [knownCodes, home]);

  async function refreshOnline() {
    if (!data.settings.onlineRatesEnabled) return;
    setBusy(true);
    const result = await fetchRates(rates.base);
    setBusy(false);
    if (!result.ok) {
      Alert.alert('Could not update rates', result.error);
      return;
    }
    dispatch({ type: 'rates/set', table: result.table });
  }

  function saveRate() {
    if (!editing) return;
    const value = Number(rateDraft.replace(/,/g, '.'));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Enter a rate greater than zero.');
      return;
    }
    dispatch({ type: 'rates/set', table: setRate(rates, editing, value) });
    setEditing(null);
  }

  function addCurrency() {
    const code = newCode.trim();
    if (!isValidCode(code)) {
      Alert.alert('Enter a three-letter currency code, like EUR or KES.');
      return;
    }
    setNewCode('');
    setEditing(normaliseCode(code));
    setRateDraft('');
  }

  const otherRates = Object.entries(rates.rates)
    .filter(([code]) => code !== rates.base)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <Screen edges={['bottom']}>
      <Body>
        <Card>
          <Field label="Amount">
            <Row gap={spacing.sm}>
              <Pressable
                onPress={() => setPicking('from')}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: theme.colors.surfaceAlt,
                }}
              >
                <Txt variant="heading">{from}</Txt>
              </Pressable>
              <View style={{ flex: 1 }}>
                <TextField
                  value={amount}
                  onChangeText={(next) => setAmount(next.replace(/[^0-9.,]/g, ''))}
                  placeholder="0"
                  keyboardType="decimal-pad"
                />
              </View>
            </Row>
          </Field>

          <Row justify="center" style={{ marginBottom: spacing.md }}>
            <Txt
              variant="heading"
              tone="primary"
              onPress={() => {
                setFrom(to);
                setTo(from);
              }}
            >
              ⇅ swap
            </Txt>
          </Row>

          <Field label="Converts to">
            <Row gap={spacing.sm}>
              <Pressable
                onPress={() => setPicking('to')}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: theme.colors.surfaceAlt,
                }}
              >
                <Txt variant="heading">{to}</Txt>
              </Pressable>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Txt variant="title" numberOfLines={1} tone={converted === null ? 'faint' : 'default'}>
                  {converted === null ? 'No rate yet' : formatMoney(converted, to, data.settings.locale)}
                </Txt>
              </View>
            </Row>
          </Field>

          {pairRate !== null ? (
            <Txt variant="caption" tone="muted">
              1 {from} = {pairRate.toPrecision(6).replace(/\.?0+$/, '')} {to} · {describeAge(rates)}
            </Txt>
          ) : (
            <Txt variant="caption" tone="warning">
              Add a rate for {converted === null && !knownCodes.includes(from) ? from : to} below to convert this pair.
            </Txt>
          )}
          {isStale(rates) && rates.updatedAt ? (
            <Txt variant="caption" tone="warning" style={{ marginTop: 4 }}>
              These rates are over a week old.
            </Txt>
          ) : null}
        </Card>

        <Spacer />

        <Card>
          <Row justify="space-between">
            <Txt variant="heading">Rates</Txt>
            <Txt variant="caption" tone="muted">
              per 1 {rates.base}
            </Txt>
          </Row>
          <Txt variant="caption" tone="faint" style={{ marginTop: 4, marginBottom: spacing.md }}>
            {data.settings.onlineRatesEnabled
              ? 'Tap a rate to correct it by hand, or refresh from the rates service.'
              : 'Type the rates you need. Turn on online rates in Settings to fetch them instead.'}
          </Txt>

          {data.settings.onlineRatesEnabled ? (
            <>
              <Button
                label={busy ? 'Fetching…' : 'Refresh rates now'}
                variant="secondary"
                loading={busy}
                onPress={refreshOnline}
              />
              <Spacer size={spacing.md} />
            </>
          ) : null}

          {otherRates.length === 0 ? (
            <Txt tone="muted">No rates yet — add one below.</Txt>
          ) : (
            otherRates.map(([code, rate], index) => (
              <View key={code}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={code}
                  subtitle={`1 ${rates.base} = ${rate} ${code}`}
                  right={
                    <Txt variant="caption" tone="primary">
                      Edit
                    </Txt>
                  }
                  onPress={() => {
                    setEditing(code);
                    setRateDraft(String(rate));
                  }}
                  onLongPress={() =>
                    Alert.alert(`Remove ${code}?`, 'The rate is deleted, not your transactions.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => dispatch({ type: 'rates/set', table: removeRate(rates, code) }),
                      },
                    ])
                  }
                />
              </View>
            ))
          )}

          <Spacer size={spacing.md} />
          <Divider />
          <Spacer size={spacing.md} />
          <Row gap={spacing.sm}>
            <View style={{ flex: 1 }}>
              <TextField
                value={newCode}
                onChangeText={(next) => setNewCode(next.toUpperCase().slice(0, 3))}
                placeholder="Add a code, e.g. KES"
              />
            </View>
            <Button label="Add" variant="secondary" onPress={addCurrency} />
          </Row>
        </Card>

        <Spacer />
        <Txt variant="caption" tone="faint">
          Converted amounts use the rates stored on this device. They are a guide,
          not a quote — a bank or card will use its own rate and add a fee.
        </Txt>
      </Body>

      <Sheet visible={picking !== null} onClose={() => setPicking(null)} title="Pick a currency">
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          {allCodes.map((code) => (
            <Chip
              key={code}
              label={code}
              selected={code === (picking === 'from' ? from : to)}
              onPress={() => {
                if (picking === 'from') setFrom(code);
                else setTo(code);
                setPicking(null);
              }}
            />
          ))}
        </Row>
      </Sheet>

      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `1 ${rates.base} = ? ${editing}` : ''}
      >
        <Field
          label={`Units of ${editing} per 1 ${rates.base}`}
          hint="Read it off a bank or search result — the same way rates are quoted."
        >
          <TextField
            value={rateDraft}
            onChangeText={(next) => setRateDraft(next.replace(/[^0-9.,]/g, ''))}
            placeholder="0.00"
            keyboardType="decimal-pad"
            autoFocus
          />
        </Field>
        <Button label="Save rate" onPress={saveRate} />
      </Sheet>
    </Screen>
  );
}
