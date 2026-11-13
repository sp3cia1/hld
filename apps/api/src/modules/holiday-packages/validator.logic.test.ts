import type { TripItem } from '@bh/shared/holiday-package';
import { RULE_IDS } from '@bh/shared/trip-check';
import { describe, expect, it } from 'vitest';
import { getCatalog } from '../catalog/catalog.loader';
import { buildPackage } from './builder.logic';
import { MENON_EXAMPLE_TRIP } from './menon-example';
import { checkTrip, validateTrip, type TripToCheck } from './validator.logic';

const catalog = getCatalog();
const menon = MENON_EXAMPLE_TRIP;

/** The Menon package with one item changed. Item ids: i1 flight, i2 transfer, i3 hotel, i4–i8 visits 11–15 Apr. */
function withItem(itemId: string, change: Partial<TripItem>): TripToCheck {
  return {
    ...menon,
    items: menon.items.map((item) => (item.item_id === itemId ? { ...item, ...change } : item)),
  };
}

/** The rules a package breaks, without repeats. */
function brokenRules(trip: TripToCheck) {
  return [...new Set(validateTrip(trip, catalog).map((problem) => problem.rule))];
}

describe('validateTrip', () => {
  it('passes the hand-checked Menon package', () => {
    expect(validateTrip(menon, catalog)).toEqual([]);
  });

  it('passes every package the builder makes, for every date, length, departure city, country and party', () => {
    const { departure_cities, countries, rules } = catalog.destinations;
    const parties = [
      { adults: 2, childAges: [6] },
      { adults: 1, childAges: [] },
      { adults: 3, childAges: [2, 15] },
    ];
    const failures: unknown[] = [];
    let built = 0;
    for (const departure of departure_cities)
      for (const country of countries)
        for (const party of parties)
          for (const startDate of datesFrom(
            rules.data_window.first_night,
            rules.data_window.last_departure,
          ))
            for (let nights = rules.min_nights; nights <= rules.max_nights; nights++) {
              const request = {
                departureAirport: departure.airport,
                country: country.code,
                startDate,
                nights,
                budgetInr: 350000,
                ...party,
              };
              if (addDays(startDate, nights) > rules.data_window.last_departure) continue;
              const outcome = buildPackage(request, catalog);
              if (outcome.status === 'NO_PACKAGE') continue;
              built++;
              const problems = validateTrip(outcome.trip, catalog);
              if (problems.length > 0) failures.push({ request, problems });
            }

    expect(built).toBeGreaterThan(1000);
    expect(failures).toEqual([]);
  });

  it.each<[string, TripToCheck, string]>([
    ['a total that is off by ₹1', { ...menon, total_inr: menon.total_inr + 1 }, 'prices'],
    [
      'a pickup 30 minutes after landing',
      withItem('i2', { start: '2027-04-10T11:00', end: '2027-04-10T12:30' }),
      'airport-transfers',
    ],
    [
      'arriving at the airport less than 180 minutes before the flight',
      withItem('i9', { start: '2027-04-16T09:00', end: '2027-04-16T10:15' }),
      'airport-transfers',
    ],
    [
      'a full day with no visit',
      { ...menon, items: menon.items.filter((item) => item.item_id !== 'i5') },
      'attraction-days',
    ],
    [
      'a visit on the last day',
      withItem('i8', { start: '2027-04-16T09:00', end: '2027-04-16T10:00' }),
      'attraction-days',
    ],
    ['the same attraction twice', withItem('i6', { catalog_id: 'ATT-TYO-004' }), 'attractions'],
    [
      'an attraction on a weekday it is closed (Shinjuku Gyoen on a Monday)',
      withItem('i5', {
        catalog_id: 'ATT-TYO-014',
        start: '2027-04-12T09:00',
        end: '2027-04-12T10:30',
      }),
      'attractions',
    ],
    ['a night with no hotel', withItem('i3', { start: '2027-04-11' }), 'hotels'],
    [
      'a room type that does not fit the party (a twin for 2 adults and a child)',
      withItem('i3', { room_id: 'RM-TYO-004-A' }),
      'rooms',
    ],
    [
      'more travelers than seats',
      { ...menon, traveler: { ...menon.traveler, adults: 10 } },
      'seats',
    ],
    [
      'a booked package without a reservation number',
      {
        ...menon,
        status: 'BOOKED',
        items: menon.items.map((item) => ({ ...item, status: 'BOOKED' as const })),
      },
      'format',
    ],
    ['a trip longer than the data allows', { ...menon, end_date: '2027-04-21' }, 'trip-dates'],
  ])('catches %s', (_, trip, rule) => {
    expect(brokenRules(trip)).toContain(rule);
  });

  it('accepts a booked package where every item carries the reservation number', () => {
    const booked: TripToCheck = {
      ...menon,
      status: 'BOOKED',
      items: menon.items.map((item) => ({
        ...item,
        status: 'BOOKED' as const,
        booking: { reference: '4821937560' },
      })),
    };
    expect(validateTrip(booked, catalog)).toEqual([]);
  });
});

describe('validateTrip on a trip with two cities', () => {
  // Menon's arrival in Tokyo for 3 nights, the 10:00 Shinkansen to Kyoto on 13 Apr, 3 nights in Kyoto, home from
  // KIX. Written by hand from the catalog, because the builder makes one-city packages for now.
  const [arrival, pickup, , visit11, visit12] = menon.items;
  const twoCities: TripToCheck = {
    ...menon,
    total_inr: 255654,
    items: [
      arrival,
      pickup,
      planned(
        'h1',
        'hotel',
        'Tokyo',
        'HTL-TYO-004',
        '2027-04-10',
        '2027-04-13',
        1,
        28392,
        'RM-TYO-004-B',
      ),
      visit11,
      visit12,
      planned('t1', 'transfer', 'Kyoto', 'TR-TYO-KYO-01', '2027-04-13T10:00', null, 3, 19838),
      planned(
        'h2',
        'hotel',
        'Kyoto',
        'HTL-KYO-002',
        '2027-04-13',
        '2027-04-16',
        1,
        31752,
        'RM-KYO-002-B',
      ),
      planned(
        'v1',
        'attraction',
        'Kyoto',
        'ATT-KYO-001',
        '2027-04-14T10:00',
        '2027-04-14T11:30',
        3,
        672,
      ),
      planned(
        'v2',
        'attraction',
        'Kyoto',
        'ATT-KYO-002',
        '2027-04-15T10:00',
        '2027-04-15T12:00',
        3,
        0,
      ),
      planned('t2', 'transfer', 'Kyoto', 'TR-KIX-KYO-TAXI', '2027-04-16T07:30', null, 1, 16800),
      planned(
        'f2',
        'flight',
        'Bengaluru',
        'FL-411',
        '2027-04-16T12:00',
        '2027-04-16T18:00',
        3,
        78120,
      ),
    ],
  };
  const change = (itemId: string, update: Partial<TripItem>): TripToCheck => ({
    ...twoCities,
    items: twoCities.items.map((item) => (item.item_id === itemId ? { ...item, ...update } : item)),
  });

  it('passes', () => {
    expect(validateTrip(twoCities, catalog)).toEqual([]);
  });

  it('catches a train that is not on its every-30-minutes timetable', () => {
    expect(brokenRules(change('t1', { start: '2027-04-13T10:10' }))).toEqual(['city-transfers']);
  });

  it('catches a change of city with no transfer between the cities', () => {
    const items = twoCities.items.filter((item) => item.item_id !== 't1');
    expect(brokenRules({ ...twoCities, items, total_inr: 255654 - 19838 })).toEqual([
      'city-transfers',
    ]);
  });

  it('catches a visit on the city-change day without the station taxi to the hotel', () => {
    const visit = planned(
      'v3',
      'attraction',
      'Kyoto',
      'ATT-KYO-004',
      '2027-04-13T16:00',
      '2027-04-13T17:00',
      3,
      0,
    );
    expect(brokenRules({ ...twoCities, items: [...twoCities.items, visit] })).toEqual([
      'attractions',
    ]);
  });
});

describe('checkTrip', () => {
  it('lists every rule, each passing for a valid package', () => {
    const check = checkTrip(menon, catalog);
    expect(check.rules.map((rule) => rule.id)).toEqual(RULE_IDS);
    expect(check.rules.every((rule) => rule.passed)).toBe(true);
    expect(check.problems).toEqual([]);
  });

  it('marks only the broken rule as failing', () => {
    const check = checkTrip({ ...menon, total_inr: menon.total_inr + 1 }, catalog);
    expect(check.rules.filter((rule) => !rule.passed).map((rule) => rule.id)).toEqual(['prices']);
  });
});

/** A PLANNED item in the trip format. Names don't matter to any rule, so the catalog id stands in. */
function planned(
  itemId: string,
  type: TripItem['type'],
  city: string,
  catalogId: string,
  start: string,
  end: string | null,
  quantity: number,
  priceInr: number,
  roomId: string | null = null,
): TripItem {
  return {
    item_id: itemId,
    type,
    name: catalogId,
    city,
    status: 'PLANNED',
    catalog_id: catalogId,
    start,
    end,
    room_id: roomId,
    quantity,
    price_inr: priceInr,
    booking: null,
    sources: [],
    warnings: [],
  };
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function datesFrom(first: string, last: string): string[] {
  const dates: string[] = [];
  for (let date = first; date <= last; date = addDays(date, 1)) dates.push(date);
  return dates;
}
