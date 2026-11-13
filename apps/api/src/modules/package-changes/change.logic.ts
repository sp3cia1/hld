import type { FieldError } from '@bh/shared/common';
import type { Trip, TripItem } from '@bh/shared/holiday-package';
import type {
  AddAttraction,
  ChangeRequest,
  FlightChange,
  HotelChange,
  RemoveAttraction,
} from '@bh/shared/package-change';
import type { RuleId, TripProblem } from '@bh/shared/trip-check';
import type { Catalog } from '../catalog/catalog.logic';
import type { Attraction } from '../catalog/catalog.schemas';
import {
  cheapestTransferFromAirport,
  cheapestTransferToAirport,
} from '../holiday-packages/logic/airport-transfers.logic';
import { earliestVisit } from '../holiday-packages/logic/attractions.logic';
import { arrivalsIn } from '../holiday-packages/logic/free-time.logic';
import type { Party } from '../holiday-packages/logic/pricing.logic';
import { roomsByHeadcount, roomsNeeded } from '../holiday-packages/logic/rooms.logic';
import {
  formatDate,
  localDateTime,
  minutesOf,
  weekdayOf,
  type Weekday,
} from '../holiday-packages/logic/time.logic';
import {
  MIN_MINUTES_BEFORE_DEPARTURE,
  VISITS_START_AT,
} from '../holiday-packages/logic/travel-rules';
import {
  attractionItem,
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
// For a visit the traveler picks the attraction and the day; the app picks the start time and, on a change day by
// train or bus, adds the taxi from the station that gets them to the hotel first.

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
    case 'add_attraction':
      return addAttraction(trip, change, catalog);
    case 'remove_attraction':
      return removeAttraction(trip, change, catalog);
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
    case 'add_attraction': {
      const errors = checkVisitDate(trip, change.date);
      if (!catalog.attractions.has(change.attractionId)) {
        errors.push({
          path: 'attractionId',
          message: `No attraction has the id ${change.attractionId}`,
        });
      }
      return errors;
    }
    case 'remove_attraction':
      return trip.items.some((item) => item.item_id === change.itemId && item.type === 'attraction')
        ? []
        : [{ path: 'itemId', message: `${change.itemId} is not a visit in this holiday` }];
  }
}

/** No message when a visit can go on `date`: from the start date up to the day before the last day. */
export function checkVisitDate(trip: Trip, date: string): FieldError[] {
  if (date === trip.end_date) return [{ path: 'date', message: 'No visits on the last day' }];
  return date >= trip.start_date && date < trip.end_date
    ? []
    : [{ path: 'date', message: `${formatDate(date)} is not a day of this holiday` }];
}

/** The city of the hotel the traveler sleeps in on the night of `date`. */
export function nightCity(trip: Trip, date: string): string {
  return trip.items.find(
    (item) => item.type === 'hotel' && item.start <= date && date < (item.end ?? ''),
  )!.city;
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

/**
 * A visit on a day of the trip, at the earliest time that fits: after the day begins (09:00 on a full day, when the
 * traveler reaches the hotel on the arrival day or a change day), while the attraction is open, and clear of the day's
 * other visits. The traveler's other visits never move.
 */
function addAttraction(trip: Trip, change: AddAttraction, catalog: Catalog): ChangeOutcome {
  const attraction = catalog.attractions.get(change.attractionId)!;
  const { date } = change;
  const day = formatDate(date);
  const party = partyOf(trip);
  const city = nightCity(trip, date);
  const notPossible = (message: string): ChangeOutcome => ({
    ok: false,
    problems: [{ rule: 'attractions', itemId: null, message }],
  });

  if (attraction.city !== city) {
    return notPossible(
      `${attraction.name} is in ${attraction.city}, but that night's hotel is in ${city}`,
    );
  }
  const already = trip.items.find(
    (item) => item.type === 'attraction' && item.catalog_id === attraction.attraction_id,
  );
  if (already) {
    return notPossible(
      `${attraction.name} is already in your plan on ${formatDate(already.start)}`,
    );
  }
  if (!attraction.open_days.includes(weekdayOf(date))) {
    return notPossible(`${attraction.name} is closed on ${WEEKDAY_NAMES[weekdayOf(date)]}s`);
  }
  if (attraction.closed_dates?.includes(date)) {
    return notPossible(`${attraction.name} is closed on ${day}`);
  }

  // The arrival day and a change day begin when the traveler reaches the hotel; a full day at VISITS_START_AT.
  const arrival = arrivalsIn(trip, catalog, party).find((a) => a.day === date);
  const start = earliestFreeStart(
    attraction,
    date,
    arrival ? arrival.at : minutesOf(VISITS_START_AT),
    visitsOn(trip, date),
  );
  if (start === null) {
    return notPossible(
      `No time left on ${day}: ${attraction.name} needs ${attraction.visit_minutes} minutes before it closes at ${attraction.open_until}`,
    );
  }

  let items = trip.items;
  const taxi = arrival?.stationTaxi;
  if (taxi && !stationTaxiOn(trip, date, catalog)) {
    // A visit on a change day by train or bus needs the taxi from the station to the hotel, right after the train.
    const train = items.findIndex(
      (item) =>
        item.type === 'transfer' &&
        item.start.slice(0, 10) === date &&
        catalog.transfers.get(item.catalog_id)!.to_city === city,
    );
    const ride = transferItem(taxi.transfer, city, date, taxi.at, party);
    items = insertAt(items, train + 1, { item_id: nextItemId(items), ...ride });
  }
  const visit = attractionItem(attraction, date, start, party);
  items = insertAt(items, visitPosition(items, date, visit.start), {
    item_id: nextItemId(items),
    ...visit,
  });
  return { ok: true, trip: withItems(trip, items) };
}

/**
 * The earliest start at or after `dayStart` when the attraction is open, the whole visit fits before it closes, and it
 * overlaps none of `visits` (minutes after midnight). Tries the start of the day, then the end of each visit.
 */
function earliestFreeStart(
  attraction: Attraction,
  date: string,
  dayStart: number,
  visits: { start: number; end: number }[],
): number | null {
  const tries = [dayStart, ...visits.map((v) => v.end).filter((end) => end > dayStart)].sort(
    (a, b) => a - b,
  );
  for (const from of tries) {
    const fit = earliestVisit(attraction, date, from);
    if (!fit) continue;
    const end = fit.start + attraction.visit_minutes;
    if (visits.every((v) => end <= v.start || fit.start >= v.end)) return fit.start;
  }
  return null;
}

/**
 * Takes a visit out. The last visit of a full day can't go: every full day keeps one. The last visit of a change day
 * takes the station taxi with it, which was there only for the visit.
 */
function removeAttraction(trip: Trip, change: RemoveAttraction, catalog: Catalog): ChangeOutcome {
  const visit = trip.items.find((item) => item.item_id === change.itemId)!;
  const date = visit.start.slice(0, 10);
  const othersThatDay = visitsOn(trip, date).length - 1;
  const changeDays = trip.items
    .filter((item) => item.type === 'hotel')
    .slice(1)
    .map((item) => item.start);
  const fullDay = date > trip.start_date && date < trip.end_date && !changeDays.includes(date);

  if (fullDay && othersThatDay === 0) {
    return refuse(
      'attraction-days',
      visit,
      'Every full day keeps at least one visit: add another first, then remove this one',
    );
  }
  const taxi = othersThatDay === 0 ? stationTaxiOn(trip, date, catalog) : undefined;
  const items = trip.items.filter((item) => item !== visit && item !== taxi);
  return { ok: true, trip: withItems(trip, items) };
}

/** The visits on `date`, in minutes after midnight. */
function visitsOn(trip: Trip, date: string): { start: number; end: number }[] {
  return trip.items
    .filter((item) => item.type === 'attraction' && item.start.slice(0, 10) === date)
    .map((item) => ({
      start: minutesOf(item.start.slice(11)),
      end: minutesOf(item.end!.slice(11)),
    }));
}

/** The taxi from the station to the hotel already in the package on `date`, if any. */
function stationTaxiOn(trip: Trip, date: string, catalog: Catalog): TripItem | undefined {
  return trip.items.find(
    (item) =>
      item.type === 'transfer' &&
      item.start.slice(0, 10) === date &&
      catalog.transfers.get(item.catalog_id)!.type === 'CITY_TAXI',
  );
}

/**
 * Where a visit starting at `start` goes, in journey order: after everything else that day (its transfers and the
 * hotel), among that day's visits by start time, before the next day.
 */
function visitPosition(items: TripItem[], date: string, start: string): number {
  const next = items.findIndex((item) => {
    const day = item.start.slice(0, 10);
    return day > date || (day === date && item.type === 'attraction' && item.start > start);
  });
  return next === -1 ? items.length : next;
}

/** The next unused id of the form `iN`. The other items keep theirs. */
function nextItemId(items: TripItem[]): string {
  const used = items.map((item) => Number(/^i(\d+)$/.exec(item.item_id)?.[1] ?? 0));
  return `i${Math.max(0, ...used) + 1}`;
}

function insertAt(items: TripItem[], index: number, item: TripItem): TripItem[] {
  return [...items.slice(0, index), item, ...items.slice(index)];
}

/** For messages: "closed on Sundays". */
const WEEKDAY_NAMES: Record<Weekday, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

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
