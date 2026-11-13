import type { Trip } from '@bh/shared/holiday-package';
import type {
  ChangeRequest,
  FlightChoice,
  FlightChoices,
  FlightDirection,
  HotelChoice,
  HotelChoices,
} from '@bh/shared/package-change';
import type { Catalog } from '../catalog/catalog.logic';
import { flightPrice, hotelPrice, travelersIn } from '../holiday-packages/logic/pricing.logic';
import { roomsNeeded } from '../holiday-packages/logic/rooms.logic';
import { daysBetween } from '../holiday-packages/logic/time.logic';
import { partyOf, tryChange } from './change.logic';

// The choices for one part of a package (decision 0013). The traveler changes one thing at a time, so a choice that
// fails now only because of another part is still listed, with the reason: hiding it would put it out of reach. Only
// what can never work for this party on these dates is left out, and counted.

/** What picking a choice would do: a dry run of the very change POST makes, so the two never disagree. */
type Preview =
  | { status: 'READY'; newTotalInr: number; differenceInr: number; reason: null }
  | { status: 'BLOCKED'; newTotalInr: null; differenceInr: null; reason: string };

/** Every room type of every hotel in a city of the plan, for that city's nights. The city must pass `checkCity`. */
export function hotelChoices(trip: Trip, city: string, catalog: Catalog): HotelChoices {
  const party = partyOf(trip);
  const stay = trip.items.find((item) => item.type === 'hotel' && item.city === city)!;
  const nights = daysBetween(stay.start, stay.end!);
  const choices: HotelChoice[] = [];
  let hidden = 0;
  for (const hotel of catalog.hotelsByCity.get(city) ?? []) {
    for (const room of catalog.roomsByHotel.get(hotel.hotel_id) ?? []) {
      const rooms = roomsNeeded(room, party);
      // No number of these rooms sleeps this party, whatever else changes.
      if (rooms === null) {
        hidden++;
        continue;
      }
      const change = {
        type: 'hotel',
        city,
        hotelId: hotel.hotel_id,
        roomId: room.room_id,
      } as const;
      choices.push({
        hotelId: hotel.hotel_id,
        roomId: room.room_id,
        hotelName: hotel.name,
        roomName: room.name,
        area: hotel.area,
        stars: hotel.stars,
        rooms,
        nights,
        priceInr: hotelPrice(room, rooms, nights),
        current: room.room_id === stay.room_id,
        ...preview(trip, change, catalog),
      });
    }
  }
  return { choices: inOrder(choices), hidden };
}

/**
 * Arrival: every flight from home that lands on the start date. Return: every flight home that leaves on the last day.
 * At any airport of the country, not only those serving the first or last city: one that doesn't comes out BLOCKED.
 */
export function flightChoices(
  trip: Trip,
  direction: FlightDirection,
  catalog: Catalog,
): FlightChoices {
  const party = partyOf(trip);
  const home = trip.traveler.home_airport;
  const airports = countryAirports(trip, catalog);
  const flights = trip.items.filter((item) => item.type === 'flight');
  const current = direction === 'arrival' ? flights[0]! : flights.at(-1)!;

  const thatDay = [...catalog.flights.values()].filter((f) =>
    direction === 'arrival'
      ? f.from === home && airports.has(f.to) && f.arrival_local.slice(0, 10) === trip.start_date
      : f.to === home && airports.has(f.from) && f.departure_local.slice(0, 10) === trip.end_date,
  );
  // Every traveler needs a seat, so a flight with fewer left can never work for this party.
  const withSeats = thatDay.filter((f) => f.seats_left >= travelersIn(party));

  const choices = withSeats.map((flight): FlightChoice => ({
    flightId: flight.flight_id,
    flightNumber: flight.flight_number,
    from: flight.from,
    to: flight.to,
    departs: flight.departure_local.slice(0, 16),
    arrives: flight.arrival_local.slice(0, 16),
    stops: flight.stops,
    priceInr: flightPrice(flight, party),
    current: flight.flight_id === current.catalog_id,
    ...preview(trip, { type: 'flight', direction, flightId: flight.flight_id }, catalog),
  }));
  return { choices: inOrder(choices), hidden: thatDay.length - withSeats.length };
}

function preview(trip: Trip, change: ChangeRequest, catalog: Catalog): Preview {
  const outcome = tryChange(trip, change, catalog);
  if (!outcome.ok) {
    return {
      status: 'BLOCKED',
      newTotalInr: null,
      differenceInr: null,
      reason: outcome.problems[0]!.message,
    };
  }
  const total = outcome.trip.total_inr;
  return {
    status: 'READY',
    newTotalInr: total,
    differenceInr: total - trip.total_inr,
    reason: null,
  };
}

/** The current choice first, then READY from the smallest difference, then BLOCKED. Ties keep the catalog's order. */
function inOrder<T extends HotelChoice | FlightChoice>(choices: T[]): T[] {
  const rank = (choice: T) => (choice.current ? 0 : choice.status === 'READY' ? 1 : 2);
  // Array sort is stable, so equal choices stay in the order the catalog lists them.
  return [...choices].sort(
    (a, b) => rank(a) - rank(b) || (a.differenceInr ?? 0) - (b.differenceInr ?? 0),
  );
}

/** The airports serving a city of the package's country. An airport that serves none of them can never work. */
function countryAirports(trip: Trip, catalog: Catalog): Set<string> {
  const country = catalog.destinations.countries.find((c) => c.name === trip.country)!;
  return new Set(
    country.cities.flatMap((city) =>
      (catalog.airportsServingCity.get(city.name) ?? []).map((airport) => airport.code),
    ),
  );
}
