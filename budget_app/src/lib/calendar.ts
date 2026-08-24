/**
 * Mirroring bills into the device calendar.
 *
 * This is the only part of the app that writes anywhere outside its own
 * storage, and it does so entirely on-device, through the calendar the user
 * picks. Nothing is uploaded — where that calendar syncs afterwards (iCloud,
 * Google, nowhere) is the user's own account setting, not something the app
 * arranges, and the Settings screen says so before permission is requested.
 *
 * One calendar event carries the whole series via a recurrence rule, rather
 * than a separate event per occurrence, so a rule that has run for years does
 * not litter the calendar with hundreds of rows.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';

import { fromISODate, type ISODate } from './dates.ts';
import { formatMoney } from './money.ts';
import type { Frequency, RecurringRule, Settings } from '../types.ts';

/** rule id -> calendar event id. Device state, so deliberately not in backups. */
const EVENT_MAP_KEY = 'pocketbook.calendarevents.v1';

const CALENDAR_TITLE = 'Pocketbook bills';

/** Bills are all-day events; this is when the day's block starts. */
const EVENT_HOUR = 9;
const EVENT_DURATION_MINUTES = 30;

type EventMap = Record<string, string>;

async function readEventMap(): Promise<EventMap> {
  try {
    const raw = await AsyncStorage.getItem(EVENT_MAP_KEY);
    return raw ? (JSON.parse(raw) as EventMap) : {};
  } catch {
    return {};
  }
}

async function writeEventMap(map: EventMap): Promise<void> {
  try {
    await AsyncStorage.setItem(EVENT_MAP_KEY, JSON.stringify(map));
  } catch {
    // A lost map only means the next sync recreates events; not fatal.
  }
}

export async function requestCalendarPermission(): Promise<boolean> {
  try {
    const { granted } = await Calendar.requestCalendarPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

export async function hasCalendarPermission(): Promise<boolean> {
  try {
    const { granted } = await Calendar.getCalendarPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

export type WritableCalendar = { id: string; title: string; source: string };

/** Calendars this app is allowed to write into. */
export async function listWritableCalendars(): Promise<WritableCalendar[]> {
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars
      .filter((c) => c.allowsModifications)
      .map((c) => ({ id: c.id, title: c.title, source: c.source?.name ?? '' }));
  } catch {
    return [];
  }
}

/**
 * The calendar to write into: the user's choice, else one the app owns.
 * Creating its own calendar keeps bills easy to hide or delete in bulk.
 */
async function resolveCalendarId(preferred: string | null): Promise<string | null> {
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (preferred) {
      const match = calendars.find((c) => c.id === preferred && c.allowsModifications);
      if (match) return match.id;
    }
    const existing = calendars.find((c) => c.title === CALENDAR_TITLE && c.allowsModifications);
    if (existing) return existing.id;

    if (Platform.OS === 'ios') {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      return await Calendar.createCalendarAsync({
        title: CALENDAR_TITLE,
        color: '#16A34A',
        entityType: Calendar.EntityTypes.EVENT,
        sourceId: defaultCalendar?.source?.id,
        name: CALENDAR_TITLE,
        ownerAccount: 'personal',
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });
    }

    const writable = calendars.find((c) => c.allowsModifications);
    return await Calendar.createCalendarAsync({
      title: CALENDAR_TITLE,
      color: '#16A34A',
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: writable?.source?.id,
      source: writable?.source,
      name: CALENDAR_TITLE,
      ownerAccount: writable?.source?.name ?? 'personal',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
  } catch {
    return null;
  }
}

/** Our repeat frequencies expressed the way the calendar API wants them. */
function recurrenceFor(frequency: Frequency): { frequency: Calendar.Frequency; interval: number } {
  switch (frequency) {
    case 'weekly':
      return { frequency: Calendar.Frequency.WEEKLY, interval: 1 };
    case 'biweekly':
      return { frequency: Calendar.Frequency.WEEKLY, interval: 2 };
    case 'monthly':
      return { frequency: Calendar.Frequency.MONTHLY, interval: 1 };
    case 'quarterly':
      return { frequency: Calendar.Frequency.MONTHLY, interval: 3 };
    case 'yearly':
      return { frequency: Calendar.Frequency.YEARLY, interval: 1 };
  }
}

function eventTimes(date: ISODate): { start: Date; end: Date } {
  const start = fromISODate(date);
  start.setHours(EVENT_HOUR, 0, 0, 0);
  const end = new Date(start.getTime() + EVENT_DURATION_MINUTES * 60 * 1000);
  return { start, end };
}

function eventDetails(rule: RecurringRule, settings: Settings) {
  const amount = formatMoney(rule.amount, settings.currency, settings.locale);
  const { start, end } = eventTimes(rule.startDate);
  const recurrence = recurrenceFor(rule.frequency);

  return {
    title: `${rule.kind === 'income' ? '💰' : '💸'} ${rule.name} · ${amount}`,
    startDate: start,
    endDate: end,
    notes:
      `${rule.kind === 'income' ? 'Expected income' : 'Payment due'}: ${amount}\n` +
      'Added by Pocketbook. Editing this event does not change the app.',
    // The calendar's own alert, separate from the app's notification, so the
    // reminder survives even if notifications are muted.
    alarms:
      rule.reminderDaysBefore > 0
        ? [{ relativeOffset: -rule.reminderDaysBefore * 24 * 60 }]
        : [{ relativeOffset: -60 }],
    recurrenceRule: {
      ...recurrence,
      ...(rule.endDate ? { endDate: fromISODate(rule.endDate) } : {}),
    },
  };
}

export type SyncResult = {
  created: number;
  updated: number;
  removed: number;
  /** Set when the whole sync could not run. */
  error?: string;
};

/**
 * Bring the calendar in line with the rules.
 *
 * Rules with `addToCalendar` off, or that are paused, have their event removed;
 * the rest are created or updated in place.
 */
export async function syncCalendar(
  rules: RecurringRule[],
  settings: Settings
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, removed: 0 };
  const map = await readEventMap();

  if (!settings.calendarEnabled) {
    // Turning the feature off should clean up after itself.
    for (const eventId of Object.values(map)) {
      try {
        await Calendar.deleteEventAsync(eventId, { futureEvents: true });
        result.removed += 1;
      } catch {
        // Already gone, or the user deleted it by hand.
      }
    }
    await writeEventMap({});
    return result;
  }

  if (!(await hasCalendarPermission())) return { ...result, error: 'no-permission' };

  const calendarId = await resolveCalendarId(settings.calendarId);
  if (!calendarId) return { ...result, error: 'no-calendar' };

  const next: EventMap = {};
  for (const rule of rules) {
    const existingId = map[rule.id];
    const wanted = rule.addToCalendar && rule.active;

    if (!wanted) {
      if (existingId) {
        try {
          await Calendar.deleteEventAsync(existingId, { futureEvents: true });
          result.removed += 1;
        } catch {
          // Nothing to remove.
        }
      }
      continue;
    }

    const details = eventDetails(rule, settings);
    if (existingId) {
      try {
        await Calendar.updateEventAsync(existingId, details, { futureEvents: true });
        next[rule.id] = existingId;
        result.updated += 1;
        continue;
      } catch {
        // The event was deleted in the calendar app; fall through and recreate.
      }
    }
    try {
      next[rule.id] = await Calendar.createEventAsync(calendarId, details);
      result.created += 1;
    } catch {
      // One failed event should not abort the rest of the sync.
    }
  }

  await writeEventMap(next);
  return result;
}

/** Drop every event this app created, e.g. when the user erases their data. */
export async function removeAllCalendarEvents(): Promise<void> {
  const map = await readEventMap();
  for (const eventId of Object.values(map)) {
    try {
      await Calendar.deleteEventAsync(eventId, { futureEvents: true });
    } catch {
      // Already gone.
    }
  }
  await writeEventMap({});
}
