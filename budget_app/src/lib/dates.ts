/**
 * Calendar helpers.
 *
 * Dates are handled as `YYYY-MM-DD` strings in the user's local calendar.
 * `Date` objects are only used for arithmetic, and are always built at local
 * noon so that DST shifts can never roll a day backwards or forwards.
 */

export type ISODate = string; // YYYY-MM-DD
export type MonthKey = string; // YYYY-MM

const DAY_MS = 24 * 60 * 60 * 1000;

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toISODate(date: Date): ISODate {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local noon `Date` for an ISO day, safe for day arithmetic. */
export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

export function today(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = fromISODate(iso);
  return toISODate(new Date(d.getTime() + days * DAY_MS));
}

/** Add months, clamping the day to the end of the target month. */
export function addMonths(iso: ISODate, months: number): ISODate {
  const d = fromISODate(iso);
  const targetMonthIndex = d.getMonth() + months;
  const year = d.getFullYear() + Math.floor(targetMonthIndex / 12);
  const month0 = ((targetMonthIndex % 12) + 12) % 12;
  const day = Math.min(d.getDate(), daysInMonth(year, month0 + 1));
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((fromISODate(to).getTime() - fromISODate(from).getTime()) / DAY_MS);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function monthKey(iso: ISODate): MonthKey {
  return iso.slice(0, 7);
}

export function monthKeyOf(year: number, month1: number): MonthKey {
  return `${year}-${pad2(month1)}`;
}

export function addMonthsToKey(key: MonthKey, months: number): MonthKey {
  return monthKey(addMonths(`${key}-01`, months));
}

export function currentMonthKey(now: Date = new Date()): MonthKey {
  return monthKey(toISODate(now));
}

export type Period = { start: ISODate; end: ISODate; key: MonthKey; label: string };

/**
 * The budget period containing `iso`.
 *
 * With `monthStartDay` of 1 this is the calendar month. With, say, 25 (a
 * common payday) the period runs the 25th through the 24th, and is keyed by
 * the month it *ends* in — which is the month most of it falls in.
 */
export function periodFor(iso: ISODate, monthStartDay = 1, locale = 'en-US'): Period {
  const day = Number(iso.slice(8, 10));
  const start = monthStartDay <= 1
    ? `${monthKey(iso)}-01`
    : day >= monthStartDay
      ? `${monthKey(iso)}-${pad2(monthStartDay)}`
      : `${addMonthsToKey(monthKey(iso), -1)}-${pad2(monthStartDay)}`;
  const end = addDays(addMonths(start, 1), -1);
  const key = monthStartDay <= 1 ? monthKey(start) : monthKey(end);
  return { start, end, key, label: formatMonthLabel(key, locale) };
}

/** The period `offset` periods away from the one containing `iso`. */
export function shiftPeriod(period: Period, offset: number, monthStartDay = 1, locale = 'en-US'): Period {
  return periodFor(addMonths(period.start, offset), monthStartDay, locale);
}

export function periodForKey(key: MonthKey, monthStartDay = 1, locale = 'en-US'): Period {
  const anchor = monthStartDay <= 1 ? `${key}-01` : `${key}-01`;
  return periodFor(anchor, monthStartDay, locale);
}

export function isWithin(iso: ISODate, start: ISODate, end: ISODate): boolean {
  return iso >= start && iso <= end;
}

export function formatMonthLabel(key: MonthKey, locale = 'en-US'): string {
  const [y, m] = key.split('-').map(Number);
  const date = new Date(y, m - 1, 1, 12);
  try {
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  } catch {
    return key;
  }
}

export function formatDateLabel(iso: ISODate, locale = 'en-US'): string {
  try {
    return fromISODate(iso).toLocaleDateString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** "Today" / "Yesterday" / "Tomorrow", else a short date. */
export function formatRelativeDay(iso: ISODate, now: ISODate = today(), locale = 'en-US'): string {
  const delta = diffDays(now, iso);
  if (delta === 0) return 'Today';
  if (delta === -1) return 'Yesterday';
  if (delta === 1) return 'Tomorrow';
  if (delta > 1 && delta <= 7) return `In ${delta} days`;
  if (delta < -1 && delta >= -7) return `${Math.abs(delta)} days ago`;
  return formatDateLabel(iso, locale);
}
