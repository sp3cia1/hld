import type { FieldError } from '@bh/shared/common';
import type { Trip, TripItem } from '@bh/shared/holiday-package';
import type { ChangeRequest, FlightChange, HotelChange } from '@bh/shared/package-change';
import type { RuleId, TripProblem } from '@bh/shared/trip-check';
import type { Catalog } from '../catalog/catalog.logic';
import {
  cheapestTransferFromAirport,
  cheapestTransferToAirport,
} from '../holiday-packages/logic/airport-transfers.logic';
import type { Party } from '../holiday-packages/logic/pricing.logic';
import { roomsByHeadcount, roomsNeeded } from '../holiday-packages/logic/rooms.logic';
import { localDateTime, minutesOf } from '../holiday-packages/logic/time.logic';
import { MIN_MINUTES_BEFORE_DEPARTURE } from '../holiday-packages/logic/travel-rules';
import {
  flightItem,
  hotelItem,
  transferItem,
  type NewItem,
} from '../holiday-packages/logic/trip-items.logic';
import { validateTrip } from '../holiday-packages/logic/validator.logic';

// One change to a saved package (M6). Every change runs the same path (decision 0011):
// 1. swap the one item the traveler chose, on a copy;
// 2. pick again the airport transfers that item affects: the app decides how and when, never what;
// 3. check the whole package with the validator, and keep it or refuse with every reason.
// The app never touches the traveler's "what": flights, hotels, visits, the cities, the moves between cities.

export type ChangeOutcome = { ok: true; trip: Trip } | { ok: false; problems: TripProblem[] };

/**
 * The package with the change applied, or the rules it would break. Pure: the same call previews a choice and makes
 * the change, so a preview never disagrees with the result. The change must have passed `checkChange`.
 */
export function tryChange(trip: Trip, change: ChangeRequest, catalog: Catalog): ChangeOutcome {
  const changed = apply(trip, change, catalog);
  if (!changed.ok) return changed;
  const problems = validateTrip(changed.trip, catalog);
  return problems.length > 0 ? { ok: false, problems } : changed;
}

function apply(trip: Trip, change: ChangeRequest, catalog: Catalog): ChangeOutcome {
  switch (change.type) {
    case 'hotel':
      return changeHotel(trip, change, catalog);
    case 'flight':
      return changeFlight(trip, change, catalog);
  }
}

/**
 * Why a change can't even be tried: an id that isn't in the catalog, a room of another hotel, a hotel or a city that
 * isn't in this package's plan. One message per field, like a request that isn't valid.
 */
export function checkChange(trip: Trip, change: ChangeRequest, catalog: Catalog): FieldError[] {
  switch (change.type) {
    case 'hotel': {
      const errors = checkCity(trip, change.city);
      const hotel = catalog.hotels.get(change.hotelId);
      const room = catalog.rooms.get(change.roomId);
      if (!hotel) {
        errors.push({ path: 'hotelId', message: `No hotel has the id ${change.hotelId}` });
      } else if (hotel.city !== change.city && errors.length === 0) {
        errors.push({
          path: 'hotelId',
          message: `${hotel.name} is in ${hotel.city}, not ${change.city}`,
        });
      }
      if (!room) {
        errors.push({ path: 'roomId', message: `No room type has the id ${change.roomId}` });
      } else if (hotel && room.hotel_id !== hotel.hotel_id) {
        errors.push({
          path: 'roomId',
          message: `${change.roomId} is not a room type of ${hotel.name}`,
        });
      }
      return errors;
    }
    case 'flight':
      return catalog.flights.has(change.flightId)
        ? []
        : [{ path: 'flightId', message: `No flight has the id ${change.flightId}` }];
  }
}

/** No message when `city` is a city of this package's plan. */
export function checkCity(trip: Trip, city: string): FieldError[] {
  return planCities(trip).includes(city)
    ? []
    : [{ path: 'city', message: `${city} is not a city of this holiday` }];
}

/** The package's cities in travel order: one hotel item each. */
export function planCities(trip: Trip): string[] {
  return trip.items.filter((item) => item.type === 'hotel').map((item) => item.city);
}

export function partyOf(trip: Trip): Party {
  return { adults: trip.traveler.adults, children: trip.traveler.child_ages.length };
}

/** Where the parts a change touches sit in `items`. The builder writes them in journey order, and changes keep it. */
type Parts = {
  arrivalFlight: number;
  returnFlight: number;
  arrivalTransfer: number;
  returnTransfer: number;
  /** One per city, in travel order. */
  hotels: number[];
};

function partsOf(trip: Trip, catalog: Catalog): Parts {
  const where = (keep: (item: TripItem) => boolean) =>
    trip.items.flatMap((item, index) => (keep(item) ? [index] : []));
  const flights = where((item) => item.type === 'flight');
  const airportTransfers = where(
    (item) => item.type === 'transfer' && catalog.transfers.get(item.catalog_id)!.airport !== null,
  );
  return {
    arrivalFlight: flights[0]!,
    returnFlight: flights.at(-1)!,
    arrivalTransfer: airportTransfers[0]!,
    returnTransfer: airportTransfers.at(-1)!,
    hotels: where((item) => item.type === 'hotel'),
  };
}

/** Another hotel or room type in one city, for the same nights. */
function changeHotel(trip: Trip, change: HotelChange, catalog: Catalog): ChangeOutcome {
  const parts = partsOf(trip, catalog);
  const party = partyOf(trip);
  const at = parts.hotels.find((index) => trip.items[index]!.city === change.city)!;
  const stay = trip.items[at]!;
  const hotel = catalog.hotels.get(change.hotelId)!;
  const room = catalog.rooms.get(change.roomId)!;
  // A room type that can't sleep everyone still goes in, so the validator refuses it in its own words.
  const rooms = roomsNeeded(room, party) ?? roomsByHeadcount(room, party);
  let items = replace(trip.items, at, hotelItem(hotel, room, rooms, stay.start, stay.end!));

  // The arrival transfer goes to the first city's hotel, the return transfer leaves from the last city's. A one-city
  // plan changes both; a middle city changes neither.
  if (at === parts.hotels[0]) {
    const repicked = arrivalTransferAgain(trip, items, parts, catalog);
    if (!repicked.ok) return repicked;
    items = repicked.items;
  }
  if (at === parts.hotels.at(-1)) {
    const repicked = returnTransferAgain(trip, items, parts, catalog);
    if (!repicked.ok) return repicked;
    items = repicked.items;
  }
  return { ok: true, trip: withItems(trip, items) };
}

/** Another arrival or return flight. */
function changeFlight(trip: Trip, change: FlightChange, catalog: Catalog): ChangeOutcome {
  const parts = partsOf(trip, catalog);
  const arriving = change.direction === 'arrival';
  const at = arriving ? parts.arrivalFlight : parts.returnFlight;
  const flight = catalog.flights.get(change.flightId)!;
  // A flight's city is where it lands: the first city for the arrival, home for the return.
  const city = arriving ? trip.items[parts.hotels[0]!]!.city : homeCity(trip, catalog);
  const items = replace(trip.items, at, flightItem(flight, city, partyOf(trip)));

  // A flight that doesn't fit the trip (an airport that doesn't serve the city, another day, another home airport)
  // leaves no transfer to pick. Refuse with the validator's reason instead of a misleading "no transfer".
  const itemId = items[at]!.item_id;
  const flightProblems = validateTrip(withItems(trip, items), catalog).filter(
    (problem) => problem.rule === 'flights' && problem.itemId === itemId,
  );
  if (flightProblems.length > 0) return { ok: false, problems: flightProblems };

  const repicked = arriving
    ? arrivalTransferAgain(trip, items, parts, catalog)
    : returnTransferAgain(trip, items, parts, catalog);
  return repicked.ok ? { ok: true, trip: withItems(trip, repicked.items) } : repicked;
}

type Picked = { ok: true; items: TripItem[] } | { ok: false; problems: TripProblem[] };

/** The transfer from the arrival airport to the first hotel, picked again for the flight and hotel in `items`. */
function arrivalTransferAgain(
  trip: Trip,
  items: TripItem[],
  parts: Parts,
  catalog: Catalog,
): Picked {
  const flight = catalog.flights.get(items[parts.arrivalFlight]!.catalog_id)!;
  const stay = items[parts.hotels[0]!]!;
  const hotel = catalog.hotels.get(stay.catalog_id)!;
  const pick = cheapestTransferFromAirport(flight, hotel, catalog, partyOf(trip));
  if (!pick) {
    return refuse(
      'airport-transfers',
      items[parts.arrivalTransfer]!,
      `No airport transfer from ${flight.to} reaches ${hotel.area} after the ${flight.arrival_local.slice(11, 16)} landing`,
    );
  }
  const transfer = transferItem(pick.transfer, stay.city, trip.start_date, pick.at, partyOf(trip));
  return { ok: true, items: replace(items, parts.arrivalTransfer, transfer) };
}

/** The transfer from the last hotel to the return airport, picked again for the flight and hotel in `items`. */
function returnTransferAgain(
  trip: Trip,
  items: TripItem[],
  parts: Parts,
  catalog: Catalog,
): Picked {
  const flight = catalog.flights.get(items[parts.returnFlight]!.catalog_id)!;
  const stay = items[parts.hotels.at(-1)!]!;
  const hotel = catalog.hotels.get(stay.catalog_id)!;
  const pick = cheapestTransferToAirport(flight, hotel, catalog, partyOf(trip));
  if (!pick) {
    const departs = minutesOf(flight.departure_local.slice(11));
    const latest = localDateTime(trip.end_date, departs - MIN_MINUTES_BEFORE_DEPARTURE).slice(11);
    return refuse(
      'airport-transfers',
      items[parts.returnTransfer]!,
      `No airport transfer from ${hotel.area} reaches ${flight.from} by ${latest}, ${MIN_MINUTES_BEFORE_DEPARTURE} minutes before the ${flight.departure_local.slice(11, 16)} flight`,
    );
  }
  const transfer = transferItem(pick.transfer, stay.city, trip.end_date, pick.at, partyOf(trip));
  return { ok: true, items: replace(items, parts.returnTransfer, transfer) };
}

function refuse(
  rule: RuleId,
  item: TripItem,
  message: string,
): { ok: false; problems: TripProblem[] } {
  return { ok: false, problems: [{ rule, itemId: item.item_id, message }] };
}

/** The item at `index` replaced in place: it keeps its `item_id` and its place in the journey. */
function replace(items: TripItem[], index: number, next: NewItem): TripItem[] {
  return items.map((item, i) => (i === index ? { item_id: item.item_id, ...next } : item));
}

/** The trip with these items, and a total that adds them up. */
function withItems(trip: Trip, items: TripItem[]): Trip {
  return { ...trip, items, total_inr: items.reduce((sum, item) => sum + item.price_inr, 0) };
}

function homeCity(trip: Trip, catalog: Catalog): string {
  return catalog.destinations.departure_cities.find(
    (d) => d.airport === trip.traveler.home_airport,
  )!.city;
}
