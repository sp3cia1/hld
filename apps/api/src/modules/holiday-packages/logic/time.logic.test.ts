import { describe, expect, it } from 'vitest';
import {
  addDays,
  departureAtOrAfter,
  earliestInWindow,
  formatDate,
  latestInWindow,
  localDateTime,
  minutesOf,
  weekdayOf,
} from './time.logic';

describe('minutesOf', () => {
  it('reads 24:00 as the end of the day, and ignores seconds', () => {
    expect(minutesOf('24:00')).toBe(1440);
    expect(minutesOf('10:30:00')).toBe(630);
  });
});

describe('earliestInWindow', () => {
  it('waits for the service to open', () => {
    expect(earliestInWindow(minutesOf('05:00'), '06:30', '22:00')).toBe(minutesOf('06:30'));
  });

  it('counts both ends of the window as inside', () => {
    expect(earliestInWindow(minutesOf('22:00'), '06:30', '22:00')).toBe(minutesOf('22:00'));
  });

  it('returns null after the last service', () => {
    expect(earliestInWindow(minutesOf('22:30'), '06:30', '22:00')).toBeNull();
  });

  it('keeps a window that runs past midnight open after midnight', () => {
    // A late landing at KIX: 22:50 + 60 min is 23:50, and the Namba shuttle runs 06:00 to 00:30.
    expect(earliestInWindow(minutesOf('23:50'), '06:00', '00:30')).toBe(minutesOf('23:50'));
    expect(earliestInWindow(1440 + 20, '06:00', '00:30')).toBe(1440 + 20);
    expect(earliestInWindow(1440 + 40, '06:00', '00:30')).toBeNull();
  });

  it("counts the early hours covered by the end of yesterday's window", () => {
    expect(earliestInWindow(minutesOf('00:10'), '06:00', '00:30')).toBe(minutesOf('00:10'));
  });
});

describe('latestInWindow', () => {
  it('keeps the latest allowed time when the service runs then', () => {
    expect(latestInWindow(minutesOf('07:05'), '05:30', '23:00')).toBe(minutesOf('07:05'));
  });

  it('moves earlier to the last service', () => {
    expect(latestInWindow(minutesOf('23:30'), '06:30', '22:00')).toBe(minutesOf('22:00'));
  });

  it('returns null before the first service', () => {
    expect(latestInWindow(minutesOf('04:00'), '05:30', '23:00')).toBeNull();
  });

  it('never goes back into the day before', () => {
    expect(latestInWindow(-20, '00:00', '24:00')).toBeNull();
  });
});

describe('dates', () => {
  it('adds days across a month end', () => {
    expect(addDays('2027-04-30', 1)).toBe('2027-05-01');
  });

  it('knows 12 Apr 2027 is a Monday', () => {
    expect(weekdayOf('2027-04-12')).toBe('MON');
  });

  it('carries minutes past midnight to the next date', () => {
    expect(localDateTime('2027-04-10', 1440 + 50)).toBe('2027-04-11T00:50');
  });

  it('formats a date for a message', () => {
    expect(formatDate('2027-04-10')).toBe('10 Apr 2027');
  });
});

describe('departureAtOrAfter', () => {
  it('takes the first train at or after 10:00 on a timetable from 06:00, every 30 minutes', () => {
    expect(departureAtOrAfter(600, '06:00', '21:30', 30)).toBe(600);
    expect(departureAtOrAfter(610, '06:00', '21:30', 30)).toBe(630);
  });

  it('counts the timetable from the first departure, not from the hour', () => {
    expect(departureAtOrAfter(600, '05:45', '23:30', 30)).toBe(615);
  });

  it('waits for a service that starts later', () => {
    expect(departureAtOrAfter(600, '12:00', '20:00', 30)).toBe(720);
  });

  it('takes the last departure when the service stops before the preferred time', () => {
    expect(departureAtOrAfter(600, '05:00', '08:10', 30)).toBe(480);
  });

  it('lets a taxi leave at any time inside its hours', () => {
    expect(departureAtOrAfter(600, '00:00', '24:00', 1)).toBe(600);
    expect(departureAtOrAfter(600, '05:00', '08:00', 1)).toBe(480);
  });
});
