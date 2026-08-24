import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, type ColorValue } from 'react-native';

import { useTheme } from '../../src/state/store.tsx';

/**
 * Emoji tab icons keep the bundle free of an icon font. The explicit line
 * height matters: emoji glyphs are taller than their point size, and without
 * it they push the tab label out of the bar.
 */
function TabIcon({ icon, color }: { icon: string; color: ColorValue }) {
  return <Text style={{ fontSize: 17, lineHeight: 19, color }}>{icon}</Text>;
}

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textFaint,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: { fontSize: 10, lineHeight: 13, fontWeight: '600' },
        tabBarIconStyle: { height: 20 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} /> }}
      />
      <Tabs.Screen
        name="transactions"
        options={{ title: 'Activity', tabBarIcon: ({ color }) => <TabIcon icon="🧾" color={color} /> }}
      />
      <Tabs.Screen
        name="budgets"
        options={{ title: 'Budgets', tabBarIcon: ({ color }) => <TabIcon icon="🎯" color={color} /> }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Reports', tabBarIcon: ({ color }) => <TabIcon icon="📊" color={color} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: ({ color }) => <TabIcon icon="⚙️" color={color} /> }}
      />
    </Tabs>
  );
}
