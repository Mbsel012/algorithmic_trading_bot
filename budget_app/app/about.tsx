import React from 'react';

import { Body, Card, Screen, Spacer, Txt } from '../src/components/ui.tsx';
import { spacing } from '../src/theme/index.ts';

const POINTS = [
  {
    icon: '🚫',
    title: 'No advertising',
    body: 'There is no ad SDK in this app, and no place for an ad to appear. Nothing in it is designed to hold your attention.',
  },
  {
    icon: '📴',
    title: 'Offline unless you say otherwise',
    body: 'Out of the box the app makes no network requests at all. The single exception is optional: if you switch on online exchange rates, tapping refresh asks a public rates service for the day\u2019s rates. That request carries none of your data — though the service sees your IP address, as any website would. Your transactions, budgets and goals never leave this device either way.',
  },
  {
    icon: '📅',
    title: 'Calendar stays on your terms',
    body: 'If you ask it to, the app writes your bills into a calendar on this device. It only ever touches the calendar you choose, and nothing else. Where that calendar syncs to afterwards is your own account setting.',
  },
  {
    icon: '🙈',
    title: 'No account, no tracking',
    body: 'There is nothing to sign up for and no analytics, crash reporting or identifiers collected.',
  },
  {
    icon: '🔐',
    title: 'Locked to you',
    body: 'An optional PIN — with Face ID or a fingerprint if your phone has one — keeps anyone holding your unlocked phone out of your finances. The PIN is stored in the device keychain and never appears in a backup file.',
  },
  {
    icon: '💾',
    title: 'Your data is yours',
    body: 'Export a full JSON backup or a CSV of your transactions whenever you want, and restore it on any device.',
  },
];

export default function AboutScreen() {
  return (
    <Screen edges={['bottom']}>
      <Body>
        <Txt variant="title">Pocketbook</Txt>
        <Txt tone="muted" style={{ marginTop: spacing.xs }}>
          A budget tracker that stays out of your way.
        </Txt>
        <Spacer />
        {POINTS.map((point) => (
          <Card key={point.title} style={{ marginBottom: spacing.md }}>
            <Txt variant="heading">
              {point.icon}  {point.title}
            </Txt>
            <Txt tone="muted" style={{ marginTop: spacing.xs }}>
              {point.body}
            </Txt>
          </Card>
        ))}
        <Spacer />
        <Txt variant="caption" tone="faint" style={{ textAlign: 'center' }}>
          Because everything is stored locally, uninstalling the app deletes your data. Keep a backup.
        </Txt>
      </Body>
    </Screen>
  );
}
