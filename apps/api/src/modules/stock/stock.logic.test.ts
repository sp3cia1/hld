import type { HolidayRequest } from '@bh/shared/holiday-package';
import { describe, expect, it } from 'vitest';
import { key } from '../catalog/catalog.logic';
import { getCatalog } from '../catalog/catalog.loader';
import { buildPackage } from '../holiday-packages/logic/builder.logic';
import { MENON_EXAMPLE_TRIP } from '../holiday-packages/logic/menon-example';
import { shortageMessage, stockNeeds, withBookedStock } from './stock.logic';

const catalog = getCatalog();
const menonTrip = { ...MENON_EXAMPLE_TRIP, trip_id: 'package-1' };
const menon: HolidayRequest = {
  departureAirport: 'BLR',
  country: 'JP',
  startDate: '2027-04-10',
  nights: 6,
  adults: 2,
  childAges: [6],
  budgetInr: 350000,
};

/** The flight ids of a built package. */
function flightsOf(outcome: ReturnType<typeof buildPackage>): string[] {
  if (outcome.status === 'NO_PACKAGE') return [];
  return outcome.trip.items.filter((item) => item.type === 'flight').map((item) => item.catalog_id);
}

describe('stockNeeds', () => {
  it('needs a seat per traveler on both flights, and the rooms on every night of the stay', () => {
    const needs = stockNeeds(menonTrip, catalog);

    expect(needs.seats).toEqual([
      { flightId: 'FL-401', seats: 3, inCatalog: 9 },
      { flightId: 'FL-412', seats: 3, inCatalog: 9 },
    ]);
    expect(needs.rooms).toEqual(
      ['2027-04-10', '2027-04-11', '2027-04-12', '2027-04-13', '2027-04-14', '2027-04-15'].map(
        (night) => ({
          roomId: 'RM-TYO-004-B',
          night,
          rooms: 1,
          inCatalog: catalog.roomsLeft.get(key('RM-TYO-004-B', night)),
        }),
      ),
    );
  });
});

describe('withBookedStock', () => {
  it('gives back the catalog itself when nothing is booked', () => {
    expect(withBookedStock(catalog, new Map(), new Map())).toBe(catalog);
  });

  it('lowers the seats and rooms that bookings took, everywhere the builder reads them, without changing the catalog', () => {
    const night = key('RM-TYO-004-B', '2027-04-12');
    const booked = withBookedStock(catalog, new Map([['FL-401', 1]]), new Map([[night, 0]]));

    const indexed = [...booked.flightsByArrival.values()].flat();
    expect(booked.flights.get('FL-401')?.seats_left).toBe(1);
    expect(indexed.find((flight) => flight.flight_id === 'FL-401')?.seats_left).toBe(1);
    expect(booked.roomsLeft.get(night)).toBe(0);
    expect(catalog.flights.get('FL-401')?.seats_left).toBe(9);
    expect(catalog.roomsLeft.get(night)).toBe(4);
  });

  it('makes the builder pick another flight once the seats it would use are booked', () => {
    expect(flightsOf(buildPackage(menon, catalog))).toContain('FL-401');

    const booked = withBookedStock(catalog, new Map([['FL-401', 2]]), new Map());

    expect(flightsOf(buildPackage(menon, booked))).not.toContain('FL-401');
  });

  it('makes the builder pick another room once the one it would use is booked on a night', () => {
    const booked = withBookedStock(
      catalog,
      new Map(),
      new Map([[key('RM-TYO-004-B', '2027-04-12'), 0]]),
    );

    const outcome = buildPackage(menon, booked);

    if (outcome.status === 'NO_PACKAGE') throw new Error('expected a package');
    const hotel = outcome.trip.items.find((item) => item.type === 'hotel');
    expect(hotel?.room_id).not.toBe('RM-TYO-004-B');
  });
});

describe('shortageMessage', () => {
  it('says which flight or room ran out, in the traveler’s words', () => {
    const needs = stockNeeds(menonTrip, catalog);

    expect(shortageMessage({ kind: 'seats', need: needs.seats[0] }, catalog)).toBe(
      "AV 520 doesn't have 3 seats left",
    );
    expect(shortageMessage({ kind: 'rooms', need: needs.rooms[2] }, catalog)).toBe(
      "Ueno Garden Inn, Family Room doesn't have 1 room left on the night of 12 Apr 2027",
    );
  });
});