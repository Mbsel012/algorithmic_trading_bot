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

/**
 * Two Android channels, because importance can only be set when a channel is
 * created — changing it later is ignored by the system. A rule marked as an
 * alarm goes to the loud channel; everything else stays a quiet banner.
 */
const CHANNEL_DEFAULT = 'bills';
const CHANNEL_ALARM = 'bills-alarm';

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
      await Notifications.setNotificationChannelAsync(CHANNEL_DEFAULT, {
        name: 'Bill reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      await Notifications.setNotificationChannelAsync(CHANNEL_ALARM, {
        name: 'Bill alarms',
        description: 'Loud reminders for bills you cannot afford to miss.',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 400, 200, 400],
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch {
      // Channel setup is best-effort.
    }
  }

  // An alarm rule is worth a notification on the day even with no lead time.
  const due = upcoming(rules, HORIZON_DAYS, asOf).filter(
    (item) => item.rule.reminderDaysBefore > 0 || item.rule.alarm
  );
  let scheduled = 0;

  for (const item of due) {
    if (scheduled >= MAX_SCHEDULED) break;
    const fireDay = addDays(item.date, -item.rule.reminderDaysBefore);
    const fireAt = fromISODate(fireDay);
    fireAt.setHours(settings.reminderHour, settings.reminderMinute, 0, 0);
    if (fireAt.getTime() <= Date.now()) continue;

    const amount = formatMoney(item.rule.amount, settings.currency, settings.locale);
    const when = formatDateLabel(item.date, settings.locale);
    const isAlarm = item.rule.alarm;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.rule.kind === 'income' ? `${item.rule.name} arrives soon` : `${item.rule.name} is due soon`,
          body: `${amount} on ${when}`,
          data: { ruleId: item.rule.id, date: item.date },
          sound: isAlarm ? 'default' : undefined,
          // Time-sensitive alerts break through iOS Focus modes; ordinary
          // reminders should not, or every bill becomes an interruption.
          interruptionLevel: isAlarm ? 'timeSensitive' : 'active',
          priority: isAlarm
            ? Notifications.AndroidNotificationPriority.MAX
            : Notifications.AndroidNotificationPriority.DEFAULT,
          vibrate: isAlarm ? [0, 400, 200, 400] : undefined,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: isAlarm ? CHANNEL_ALARM : CHANNEL_DEFAULT,
        },
      });
      scheduled += 1;
    } catch {
      // One bad schedule should not stop the rest.
    }
  }

  return { scheduled, permitted: true };
}
