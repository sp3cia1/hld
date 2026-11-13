import type { Trip } from '@bh/shared/holiday-package';
import type { ChangeRequest, FlightChoice, HotelChoice } from '@bh/shared/package-change';
import { describe, expect, it } from 'vitest';
import { getCatalog } from '../catalog/catalog.loader';
import { MENON_EXAMPLE_TRIP } from '../holiday-packages/logic/menon-example';
import { tryChange } from './change.logic';
import { attractionChoices, flightChoices, hotelChoices } from './choices.logic';

const catalog = getCatalog();
const menon: Trip = { ...MENON_EXAMPLE_TRIP, trip_id: 'menon' };

describe('flightChoices', () => {
  it('lists the arrival flights: the current one, then by difference, then those another change must come first', () => {
    const { choices, hidden } = flightChoices(menon, 'arrival', catalog);

    expect(choices.map(summary)).toEqual([
      ['FL-401', 'READY', 0, true],
      ['FL-405', 'READY', 4620, false],
      ['FL-740', 'BLOCKED', null, false],
    ]);
    expect(choices[2]!.reason).toBe("KIX doesn't serve Tokyo, the first city");
    // FL-403 is the cheapest flight that day, but it has 2 seats left for 3 travelers.
    expect(hidden).toBe(1);
  });

  it('lists the return flights', () => {
    const { choices, hidden } = flightChoices(menon, 'return', catalog);

    expect(choices.map(summary)).toEqual([
      ['FL-412', 'READY', 0, true],
      ['FL-411', 'BLOCKED', null, false],
    ]);
    expect(hidden).toBe(0);
  });
});

describe('hotelChoices', () => {
  const { choices, hidden } = hotelChoices(menon, 'Tokyo', catalog);

  it('lists the current room first, then the others by difference, then the blocked ones', () => {
    expect(choices[0]).toMatchObject({ roomId: 'RM-TYO-004-B', current: true, differenceInr: 0 });
    const rest = choices.slice(1);
    const firstBlocked = rest.findIndex((c) => c.status === 'BLOCKED');
    const ready = rest.slice(0, firstBlocked).map((c) => c.differenceInr);
    expect(ready).toEqual([...ready].sort((a, b) => a! - b!));
    expect(rest.slice(firstBlocked).every((c) => c.status === 'BLOCKED')).toBe(true);
  });

  it('leaves out the room types that can’t sleep everyone, and counts them', () => {
    // Tokyo's 3 single rooms each hold one adult.
    expect(hidden).toBe(3);
    expect(choices.some((c) => c.roomName === 'Single Room')).toBe(false);
  });

  it('lists a room that is full on one of the nights as blocked, with the reason', () => {
    expect(choices.find((c) => c.roomId === 'RM-TYO-001-B')).toMatchObject({
      status: 'BLOCKED',
      reason: 'Only 0 Family Room left on the night of 2027-04-12, and 1 are needed',
    });
  });
});

it('previews every ready choice at exactly the total the change produces', () => {
  const hotels = hotelChoices(menon, 'Tokyo', catalog).choices.map(
    (c) => [c, hotelChange(c)] as const,
  );
  const flights = (['arrival', 'return'] as const).flatMap((direction) =>
    flightChoices(menon, direction, catalog).choices.map(
      (c) => [c, { type: 'flight', direction, flightId: c.flightId }] as const,
    ),
  );

  for (const [choice, change] of [...hotels, ...flights]) {
    if (choice.status !== 'READY') continue;
    const outcome = tryChange(menon, change, catalog);
    expect(outcome.ok && outcome.trip.total_inr).toBe(choice.newTotalInr);
  }
});

function summary(choice: FlightChoice) {
  return [choice.flightId, choice.status, choice.differenceInr, choice.current];
}

function hotelChange(choice: HotelChoice): ChangeRequest {
  return { type: 'hotel', city: 'Tokyo', hotelId: choice.hotelId, roomId: choice.roomId };
}

describe('attractionChoices', () => {
  it('lists the city’s attractions for a day, ready ones by difference, then the blocked ones with the reason', () => {
    const { choices, hidden } = attractionChoices(menon, '2027-04-11', catalog);

    const ready = choices.filter((c) => c.status === 'READY');
    expect(choices.slice(0, ready.length)).toEqual(ready);
    expect(ready.map((c) => c.differenceInr)).toEqual(
      [...ready].map((c) => c.differenceInr).sort((a, b) => a! - b!),
    );
    expect(choices.find((c) => c.attractionId === 'ATT-TYO-013')).toMatchObject({
      status: 'BLOCKED',
      start: null,
      reason: 'Tsukiji Outer Market is closed on Sundays',
    });
    // Kyoto's 12 and Osaka's 9 need another plan of cities.
    expect(hidden).toBe(21);
    expect(choices.every((c) => catalog.attractions.get(c.attractionId)!.city === 'Tokyo')).toBe(
      true,
    );
  });

  it('never offers a start before the family reaches the hotel on the arrival day', () => {
    const starts = attractionChoices(menon, '2027-04-10', catalog).choices.flatMap((c) =>
      c.start ? [c.start] : [],
    );

    expect(starts.length).toBeGreaterThan(0);
    expect(starts.every((start) => start >= '2027-04-10T13:00')).toBe(true);
  });

  it('previews every ready visit at exactly the total the change produces', () => {
    for (const choice of attractionChoices(menon, '2027-04-11', catalog).choices) {
      if (choice.status !== 'READY') continue;
      const change = {
        type: 'add_attraction',
        date: '2027-04-11',
        attractionId: choice.attractionId,
      } as const;
      const outcome = tryChange(menon, change, catalog);
      expect(outcome.ok && outcome.trip.total_inr).toBe(choice.newTotalInr);
    }
  });
});
