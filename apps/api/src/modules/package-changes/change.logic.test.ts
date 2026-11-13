import type { Trip } from '@bh/shared/holiday-package';
import type { ChangeRequest } from '@bh/shared/package-change';
import { describe, expect, it } from 'vitest';
import { getCatalog } from '../catalog/catalog.loader';
import { buildPackage } from '../holiday-packages/logic/builder.logic';
import { MENON_EXAMPLE_TRIP } from '../holiday-packages/logic/menon-example';
import { roomsNeeded } from '../holiday-packages/logic/rooms.logic';
import { validateTrip } from '../holiday-packages/logic/validator.logic';
import { partyOf, tryChange } from './change.logic';

const catalog = getCatalog();
/** Item ids: i1 FL-401 into NRT, i2 the Narita bus to Ueno, i3 the Ueno hotel, i4–i8 visits, i9 the Haneda bus, i10 FL-412 home. */
const menon: Trip = { ...MENON_EXAMPLE_TRIP, trip_id: 'menon' };

describe('tryChange', () => {
  it('takes a flight that lands late and picks the taxi, because the last bus has gone', () => {
    // FL-405 lands at NRT at 21:30, so the pickup can't be before 22:30. The bus to Ueno stops at 22:00.
    const after = applied(menon, { type: 'flight', direction: 'arrival', flightId: 'FL-405' });

    expect(after.items.map((item) => item.item_id)).toEqual(
      menon.items.map((item) => item.item_id),
    );
    expect(changedItems(menon, after)).toEqual(['i1', 'i2']);
    expect(item(after, 'i2')).toMatchObject({
      catalog_id: 'TR-NRT-UEN-TAXI',
      start: '2027-04-10T22:30',
      price_inr: 12880,
    });
    // Seats ₹3,780 less, the taxi ₹8,400 more than the bus.
    expect(after.total_inr - menon.total_inr).toBe(4620);
    expect(validateTrip(after, catalog)).toEqual([]);
  });

  it.each<[string, ChangeRequest, string, string]>([
    [
      'an arrival at KIX, which serves Osaka and Kyoto',
      { type: 'flight', direction: 'arrival', flightId: 'FL-740' },
      'i1',
      "KIX doesn't serve Tokyo, the first city",
    ],
    [
      'a return from KIX',
      { type: 'flight', direction: 'return', flightId: 'FL-411' },
      'i10',
      "KIX doesn't serve Tokyo, the last city",
    ],
  ])('refuses %s in the validator’s words', (_, change, itemId, message) => {
    expect(tryChange(menon, change, catalog)).toEqual({
      ok: false,
      problems: [{ rule: 'flights', itemId, message }],
    });
  });

  it('moves to a hotel in another area and picks both airport transfers again for it', () => {
    // One city is both the first and the last, so both transfers follow the hotel to Asakusa.
    const after = applied(menon, {
      type: 'hotel',
      city: 'Tokyo',
      hotelId: 'HTL-TYO-003',
      roomId: 'RM-TYO-003-C',
    });

    expect(changedItems(menon, after)).toEqual(['i2', 'i3', 'i9']);
    expect(item(after, 'i2')).toMatchObject({
      catalog_id: 'TR-NRT-ASA-BUS',
      start: '2027-04-10T11:30',
    });
    expect(item(after, 'i3')).toMatchObject({
      room_id: 'RM-TYO-003-C',
      quantity: 1,
      price_inr: 62496,
    });
    expect(item(after, 'i9')).toMatchObject({
      catalog_id: 'TR-HND-ASA-BUS',
      start: '2027-04-16T07:05',
    });
  });

  it('refuses a room type that can’t sleep everyone', () => {
    // A single room holds one adult, and each room needs an adult: no number of them fits 2 adults and a child.
    const outcome = tryChange(
      menon,
      { type: 'hotel', city: 'Tokyo', hotelId: 'HTL-TYO-008', roomId: 'RM-TYO-008-A' },
      catalog,
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems[0]).toMatchObject({ rule: 'rooms', itemId: 'i3' });
  });

  it('refuses a room that is full on one of the nights', () => {
    expect(
      tryChange(
        menon,
        { type: 'hotel', city: 'Tokyo', hotelId: 'HTL-TYO-001', roomId: 'RM-TYO-001-B' },
        catalog,
      ),
    ).toEqual({
      ok: false,
      problems: [
        {
          rule: 'rooms',
          itemId: 'i3',
          message: 'Only 0 Family Room left on the night of 2027-04-12, and 1 are needed',
        },
      ],
    });
  });

  describe('in a trip of two cities', () => {
    // Delhi, 1 Apr, 5 nights: Tokyo for 2 nights, then Osaka for 3. The only flight in lands at HND, the only one home
    // leaves from KIX.
    const trip = saved({
      departureAirport: 'DEL',
      country: 'JP',
      startDate: '2027-04-01',
      nights: 5,
      adults: 2,
      childAges: [6],
      budgetInr: 350000,
    });
    const [arrivalTransfer, returnTransfer] = trip.items
      .filter((i) => i.type === 'transfer' && catalog.transfers.get(i.catalog_id)!.airport !== null)
      .map((i) => i.item_id);

    it.each([
      ['Tokyo', 'first', arrivalTransfer],
      ['Osaka', 'last', returnTransfer],
    ])(
      'a hotel change in %s, the %s city, picks only its own airport transfer again',
      (city, _, transfer) => {
        const stay = trip.items.find((i) => i.type === 'hotel' && i.city === city)!;
        const after = firstHotelInAnotherArea(
          trip,
          city,
          catalog.hotels.get(stay.catalog_id)!.area,
        );

        expect(changedItems(trip, after)).toEqual([stay.item_id, transfer].sort());
      },
    );
  });
});

/** The trip after a change that must be applied. */
function applied(trip: Trip, change: ChangeRequest): Trip {
  const outcome = tryChange(trip, change, catalog);
  if (!outcome.ok) throw new Error(outcome.problems.map((p) => p.message).join('; '));
  return outcome.trip;
}

/** The ids of the items that differ, in item-id order. */
function changedItems(before: Trip, after: Trip): string[] {
  return after.items
    .filter((it, i) => JSON.stringify(it) !== JSON.stringify(before.items[i]))
    .map((it) => it.item_id)
    .sort();
}

function item(trip: Trip, itemId: string) {
  return trip.items.find((it) => it.item_id === itemId);
}

function saved(request: Parameters<typeof buildPackage>[0]): Trip {
  const outcome = buildPackage(request, catalog);
  if (outcome.status === 'NO_PACKAGE') throw new Error(outcome.reason.message);
  return { ...outcome.trip, trip_id: 'two-cities' };
}

/** The first room type in `city`, in catalog order, at a hotel outside `area` that the change accepts. */
function firstHotelInAnotherArea(trip: Trip, city: string, area: string): Trip {
  for (const hotel of catalog.hotelsByCity.get(city) ?? []) {
    if (hotel.area === area) continue;
    for (const room of catalog.roomsByHotel.get(hotel.hotel_id) ?? []) {
      if (roomsNeeded(room, partyOf(trip)) === null) continue;
      const change = {
        type: 'hotel',
        city,
        hotelId: hotel.hotel_id,
        roomId: room.room_id,
      } as const;
      const outcome = tryChange(trip, change, catalog);
      if (outcome.ok) return outcome.trip;
    }
  }
  throw new Error(`No hotel outside ${area} in ${city} works`);
}
