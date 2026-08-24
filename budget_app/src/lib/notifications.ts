/**
 * Local bill reminders.
 *
 * Everything here is local to the device — no push tokens, no server. The
 * whole module degrades quietly: if permission is refused, or the runtime does
 * not support scheduling (Expo Go on Android, for instance), the app still
 * shows upcoming bills in the Home screen and nothing throws.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, fromISODate, formatDateLabel, type ISODate } from './dates.ts';
import { formatMoney } from './money.ts';
import { upcoming } from './recurring.ts';
import type { RecurringRule, Settings } from '../types.ts';

/** iOS caps pending local notifications at 64; stay well inside that. */
const MAX_SCHEDULED = 32;

/** How far ahead reminders are scheduled. Re-synced on every app launch. */
const HORIZON_DAYS = 120;

let handlerInstalled = false;

export function installNotificationHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Nothing to cancel on a runtime without scheduling support.
  }
}

/**
 * Rebuild the whole reminder schedule from the current rules.
 *
 * Cancel-then-reschedule is deliberate: rules change often enough that
 * tracking individual notification ids would drift out of sync with the data.
 */
export async function syncReminders(
  rules: RecurringRule[],
  settings: Settings,
  asOf: ISODate
): Promise<{ scheduled: number; permitted: boolean }> {
  await cancelAllReminders();
  if (!settings.remindersEnabled) return { scheduled: 0, permitted: true };

  const permitted = await requestPermission();
  if (!permitted) return { scheduled: 0, permitted: false };

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('bills', {
        name: 'Bill reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch {
      // Channel setup is best-effort.
    }
  }

  const due = upcoming(rules, HORIZON_DAYS, asOf).filter((item) => item.rule.reminderDaysBefore > 0);
  let scheduled = 0;

  for (const item of due) {
    if (scheduled >= MAX_SCHEDULED) break;
    const fireDay = addDays(item.date, -item.rule.reminderDaysBefore);
    const fireAt = fromISODate(fireDay);
    fireAt.setHours(settings.reminderHour, settings.reminderMinute, 0, 0);
    if (fireAt.getTime() <= Date.now()) continue;

    const amount = formatMoney(item.rule.amount, settings.currency, settings.locale);
    const when = formatDateLabel(item.date, settings.locale);
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.rule.kind === 'income' ? `${item.rule.name} arrives soon` : `${item.rule.name} is due soon`,
          body: `${amount} on ${when}`,
          data: { ruleId: item.rule.id, date: item.date },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: 'bills',
        },
      });
      scheduled += 1;
    } catch {
      // One bad schedule should not stop the rest.
    }
  }

  return { scheduled, permitted: true };
}
