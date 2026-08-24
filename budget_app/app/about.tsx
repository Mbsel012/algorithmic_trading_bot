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
    title: 'No network access',
    body: 'The app makes no network requests at all. Your transactions, budgets and goals never leave the device they were typed into.',
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
