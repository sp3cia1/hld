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

describe('adding and removing visits', () => {
  // Menon visits: i4 Senso-ji on Sun 11 Apr 09:00–10:00, then one visit a day to 15 Apr. 16 Apr is the last day.
  const add = (date: string, attractionId: string): ChangeRequest => ({
    type: 'add_attraction',
    date,
    attractionId,
  });

  it('gives a new visit the earliest time that fits, after the day’s other visits', () => {
    const after = applied(menon, add('2027-04-11', 'ATT-TYO-001'));

    expect(item(after, 'i11')).toMatchObject({
      name: 'teamLab Planets TOKYO',
      start: '2027-04-11T10:00',
      end: '2027-04-11T12:00',
    });
    // 2 adults × ₹2,128 + the child's ₹840.
    expect(after.total_inr - menon.total_inr).toBe(5096);
    // The other items keep their ids; the visit sits after Senso-ji, in journey order.
    expect(after.items.map((it) => it.item_id)).toEqual([
      'i1',
      'i2',
      'i3',
      'i4',
      'i11',
      'i5',
      'i6',
      'i7',
      'i8',
      'i9',
      'i10',
    ]);
  });

  it('takes a third visit on a day: there is no maximum after a change', () => {
    const two = applied(menon, add('2027-04-11', 'ATT-TYO-001'));
    const three = applied(two, add('2027-04-11', 'ATT-TYO-007'));

    expect(item(three, 'i12')).toMatchObject({ name: 'Tokyo Skytree', start: '2027-04-11T12:00' });
  });

  it('starts a visit on the arrival day once the family reaches the hotel', () => {
    // The Narita bus picks up at 11:30 and takes 90 minutes.
    const after = applied(menon, add('2027-04-10', 'ATT-TYO-001'));

    expect(item(after, 'i11')!.start).toBe('2027-04-10T13:00');
  });

  it.each([
    [
      'closed that weekday',
      '2027-04-11',
      'ATT-TYO-013',
      'Tsukiji Outer Market is closed on Sundays',
    ],
    ['closed that date', '2027-04-12', 'ATT-TYO-002', 'Tokyo Disneyland is closed on 12 Apr 2027'],
    [
      'already in the plan',
      '2027-04-13',
      'ATT-TYO-004',
      'Senso-ji is already in your plan on 11 Apr 2027',
    ],
    [
      'in another city',
      '2027-04-13',
      'ATT-KYO-003',
      "Kinkaku-ji is in Kyoto, but that night's hotel is in Tokyo",
    ],
  ])('refuses a visit %s, in the traveler’s words', (_, date, attractionId, message) => {
    expect(tryChange(menon, add(date, attractionId), catalog)).toEqual({
      ok: false,
      problems: [{ rule: 'attractions', itemId: null, message }],
    });
  });

  it('refuses a visit with no time left before closing', () => {
    // Senso-ji 09:00–10:00, teamLab 10:00–12:00, Skytree 12:00–13:30: Disneyland's 480 minutes from 13:30 would end
    // at 21:30, after it closes.
    const busy = applied(
      applied(menon, add('2027-04-11', 'ATT-TYO-001')),
      add('2027-04-11', 'ATT-TYO-007'),
    );

    expect(tryChange(busy, add('2027-04-11', 'ATT-TYO-002'), catalog)).toEqual({
      ok: false,
      problems: [
        {
          rule: 'attractions',
          itemId: null,
          message:
            'No time left on 11 Apr 2027: Tokyo Disneyland needs 480 minutes before it closes at 21:00',
        },
      ],
    });
  });

  it('refuses to remove the only visit of a full day, and allows it once another is added', () => {
    const remove = { type: 'remove_attraction', itemId: 'i4' } as const;

    expect(tryChange(menon, remove, catalog)).toEqual({
      ok: false,
      problems: [
        {
          rule: 'attraction-days',
          itemId: 'i4',
          message:
            'Every full day keeps at least one visit: add another first, then remove this one',
        },
      ],
    });
    const two = applied(menon, add('2027-04-11', 'ATT-TYO-001'));
    expect(item(applied(two, remove), 'i4')).toBeUndefined();
  });

  describe('on a day the family changes city by train', () => {
    // Delhi, 1 Apr, 5 nights: the Shinkansen to Osaka leaves Tokyo at 10:00 on 3 Apr and arrives at 12:30.
    const trip = saved({
      departureAirport: 'DEL',
      country: 'JP',
      startDate: '2027-04-01',
      nights: 5,
      adults: 2,
      childAges: [6],
      budgetInr: 350000,
    });
    const train = trip.items.find((it) => it.catalog_id === 'TR-TYO-OSA-01')!;
    const visit = add('2027-04-03', 'ATT-OSA-007');

    it('adds the taxi from the station, with its price, and starts the visit once it reaches the hotel', () => {
      const after = applied(trip, visit);
      const at = after.items.findIndex((it) => it.item_id === train.item_id);
      const taxi = after.items[at + 1]!;

      expect(taxi).toMatchObject({ catalog_id: 'TR-OSA-CITY-TAXI', start: '2027-04-03T12:30' });
      expect(after.total_inr - trip.total_inr).toBe(taxi.price_inr + item(after, 'i12')!.price_inr);
      expect(item(after, 'i12')!.start).toBe('2027-04-03T12:50');
      expect(validateTrip(after, catalog)).toEqual([]);
    });

    it('takes the taxi out again with the day’s last visit', () => {
      const after = applied(trip, visit);

      expect(applied(after, { type: 'remove_attraction', itemId: 'i12' })).toEqual(trip);
    });
  });
});
