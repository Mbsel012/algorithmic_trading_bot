import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { today } from '../src/lib/dates.ts';
import { installNotificationHandler, syncReminders } from '../src/lib/notifications.ts';
import { AppProvider, useApp } from '../src/state/store.tsx';

function RootNavigator() {
  const { theme, data, ready } = useApp();

  // Rebuild the reminder schedule whenever the rules or reminder settings move.
  useEffect(() => {
    if (!ready) return;
    installNotificationHandler();
    void syncReminders(data.recurring, data.settings, today());
  }, [ready, data.recurring, data.settings.remindersEnabled, data.settings.reminderHour, data.settings.reminderMinute]);

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTitleStyle: { color: theme.colors.text },
          headerTintColor: theme.colors.primary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal', title: 'Transaction' }} />
        <Stack.Screen name="recurring/index" options={{ title: 'Recurring' }} />
        <Stack.Screen name="recurring/[id]" options={{ presentation: 'modal', title: 'Recurring' }} />
        <Stack.Screen name="goals/index" options={{ title: 'Savings goals' }} />
        <Stack.Screen name="goals/[id]" options={{ title: 'Goal' }} />
        <Stack.Screen name="categories" options={{ title: 'Categories' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <RootNavigator />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
