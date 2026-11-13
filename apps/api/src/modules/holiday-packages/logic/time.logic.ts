// Times in the data are local clock times with no UTC offset. Every rule compares times at one place, in that
// place's local time, so plain minutes after midnight are enough: no time zones are needed.

/** Minutes in a day. */
export const DAY = 24 * 60;

export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

const WEEKDAYS: Weekday[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `HH:MM` (or the time part of a date-time) to minutes after midnight. `24:00` is 1440, the end of the day. */
export function minutesOf(clock: string): number {
  return Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
}

/** A window in minutes after midnight. A window that ends at or before it starts runs past midnight. */
export function windowOf(from: string, until: string): [number, number] {
  const start = minutesOf(from);
  const end = minutesOf(until);
  return [start, end <= start ? end + DAY : end];
}

/**
 * The earliest time at or after `time` inside the window, or null. `time` may pass 1440 (after midnight). A window
 * that runs past midnight covers those minutes, and the end of yesterday's window covers the early hours.
 */
export function earliestInWindow(time: number, from: string, until: string): number | null {
  const [start, end] = windowOf(from, until);
  let best: number | null = null;
  for (const shift of [-DAY, 0]) {
    const candidate = Math.max(time, start + shift);
    if (candidate <= end + shift && (best === null || candidate < best)) best = candidate;
  }
  return best;
}

/** The latest time at or before `time` inside the window, on the same day (never before midnight), or null. */
export function latestInWindow(time: number, from: string, until: string): number | null {
  const [start, end] = windowOf(from, until);
  let best: number | null = null;
  for (const shift of [-DAY, 0]) {
    const candidate = Math.min(time, end + shift);
    if (candidate >= start + shift && candidate >= 0 && (best === null || candidate > best)) {
      best = candidate;
    }
  }
  return best;
}

/**
 * The first departure at or after `preferred` (minutes after midnight) of a service that runs from `from` to `until`
 * and leaves every `every` minutes (1 for a taxi, which leaves at any time), or its last departure when it stops
 * before `preferred`. A service window is never empty, so there is always a departure.
 */
export function departureAtOrAfter(
  preferred: number,
  from: string,
  until: string,
  every: number,
): number {
  const [start, end] = windowOf(from, until);
  if (preferred <= start) return start;
  const next = start + Math.ceil((preferred - start) / every) * every;
  return next <= end ? next : start + Math.floor((end - start) / every) * every;
}

/** `2027-04-30` plus 1 day is `2027-05-01`. */
export function addDays(date: string, days: number): string {
  return asUtcDate(date, days).toISOString().slice(0, 10);
}

/** Whole days from one date to another: `2027-04-10` to `2027-04-16` is 6, the nights of a stay. */
export function daysBetween(from: string, to: string): number {
  return (asUtcDate(to, 0).getTime() - asUtcDate(from, 0).getTime()) / (DAY * 60_000);
}

export function weekdayOf(date: string): Weekday {
  return WEEKDAYS[asUtcDate(date, 0).getUTCDay()]!;
}

/** `2027-04-10` and 1490 minutes is `2027-04-11T00:50`. */
export function localDateTime(date: string, minutes: number): string {
  const days = Math.floor(minutes / DAY);
  const rest = minutes - days * DAY;
  return `${addDays(date, days)}T${pad(Math.floor(rest / 60))}:${pad(rest % 60)}`;
}

/** `2027-04-10` is `10 Apr 2027`, for messages. */
export function formatDate(date: string): string {
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}

// Calendar arithmetic only: UTC avoids daylight saving, so a day is always 24 hours.
function asUtcDate(date: string, plusDays: number): Date {
  const [year, month, day] = [date.slice(0, 4), date.slice(5, 7), date.slice(8, 10)].map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + plusDays));
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
