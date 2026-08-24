import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LockScreen } from '../src/components/LockScreen.tsx';
import { today } from '../src/lib/dates.ts';
import { installNotificationHandler, syncReminders } from '../src/lib/notifications.ts';
import { LockProvider, useLock } from '../src/state/lockContext.tsx';
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
        <Stack.Screen name="lock-setup" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
      </Stack>
    </>
  );
}

/**
 * Holds the app behind the PIN screen while it is locked. Rendering the lock
 * *instead of* the navigator — rather than over it — means no screen ever
 * mounts, so nothing sensitive can flash on screen or land in the app switcher
 * preview before the lock appears.
 */
function LockGate({ children }: { children: React.ReactNode }) {
  const { ready, locked } = useLock();
  const { theme } = useApp();

  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  if (locked) return <LockScreen />;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <LockProvider>
            <LockGate>
              <RootNavigator />
            </LockGate>
          </LockProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
