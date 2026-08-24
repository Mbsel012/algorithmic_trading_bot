import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { today } from '../../src/lib/dates.ts';
import { summariseGoals } from '../../src/lib/goals.ts';
import { Body, Card, Divider, ListItem, Screen, Spacer, Txt } from '../../src/components/ui.tsx';
import { useApp } from '../../src/state/store.tsx';
import { spacing } from '../../src/theme/index.ts';

export default function MoreScreen() {
  const router = useRouter();
  const { data, money } = useApp();
  const goals = useMemo(() => summariseGoals(data.goals, today()), [data.goals]);

  const activeRules = data.recurring.filter((r) => r.active).length;

  const links = [
    {
      icon: '🎯',
      title: 'Savings goals',
      subtitle:
        goals.activeCount + goals.completedCount === 0
          ? 'Set a target and track it'
          : `${money(goals.totalSaved)} saved across ${goals.activeCount + goals.completedCount} goals`,
      href: '/goals',
    },
    {
      icon: '🔁',
      title: 'Recurring & bills',
      subtitle: activeRules === 0 ? 'Automate rent, salary, subscriptions' : `${activeRules} active`,
      href: '/recurring',
    },
    {
      icon: '💱',
      title: 'Currency converter',
      subtitle:
        data.rates.updatedAt === null
          ? 'Convert between currencies'
          : `${Object.keys(data.rates.rates).length} rates · base ${data.rates.base}`,
      href: '/converter',
    },
    {
      icon: '🏷️',
      title: 'Categories',
      subtitle: `${data.categories.filter((c) => !c.archived).length} in use`,
      href: '/categories',
    },
    {
      icon: '⚙️',
      title: 'Settings',
      subtitle: `${data.settings.currency} · backup and restore`,
      href: '/settings',
    },
    { icon: '🔒', title: 'About & privacy', subtitle: 'No ads, no accounts, no tracking', href: '/about' },
  ] as const;

  return (
    <Screen>
      <Body>
        <Txt variant="title">More</Txt>
        <Spacer />
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          {links.map((link, index) => (
            <View key={link.href}>
              {index > 0 ? <Divider /> : null}
              <ListItem
                icon={link.icon}
                title={link.title}
                subtitle={link.subtitle}
                right={
                  <Txt variant="heading" tone="faint">
                    ›
                  </Txt>
                }
                onPress={() => router.push(link.href)}
              />
            </View>
          ))}
        </Card>
        <Spacer />
        <Txt variant="caption" tone="faint" style={{ textAlign: 'center' }}>
          Everything stays on this device.
        </Txt>
      </Body>
    </Screen>
  );
}
