import type { HolidayRequest, NoPackageReason, Trip, TripItem } from '@bh/shared/holiday-package';
import { key, type Catalog } from '../catalog/catalog.logic';
import type { Attraction, Flight, Hotel, Room, Transfer } from '../catalog/catalog.schemas';
import { assignCheapest } from './attractions.logic';
import {
  attractionPrice,
  flightPrice,
  hotelPrice,
  transferPrice,
  transferQuantity,
  travelersIn,
  type Party,
} from './pricing.logic';
import { roomsNeeded } from './rooms.logic';
import {
  addDays,
  earliestInWindow,
  formatDate,
  latestInWindow,
  localDateTime,
  minutesOf,
  weekdayOf,
  windowOf,
} from './time.logic';
import {
  MIN_MINUTES_AFTER_LANDING,
  MIN_MINUTES_BEFORE_DEPARTURE,
  VISITS_START_AT,
} from './travel-rules';

// Builds a package for a request that passed `checkRequest`. v1: every plan stays in one city.
// ARCHITECTURE.md ("Building a package") explains each step.

export type PlannedTrip = Omit<Trip, 'trip_id'>;

export type BuildOutcome =
  | { status: 'OK' | 'OVER_BUDGET'; trip: PlannedTrip }
  | { status: 'NO_PACKAGE'; reason: NoPackageReason };

/** The steps a city can fail at, in the order they are tried. The furthest one explains a NO_PACKAGE. */
const STAGES = ['arrival', 'return', 'room', 'transfer', 'attractions'] as const;
type Stage = (typeof STAGES)[number];

type Context = {
  catalog: Catalog;
  request: HolidayRequest;
  party: Party;
  travelers: number;
  departureCity: string;
  country: { name: string; cities: string[] };
  start: string;
  lastDay: string;
  /** The dates the traveler sleeps in a hotel: the start date up to the day before the last day. */
  nights: string[];
  /** Every day after the arrival day and before the last day. */
  fullDays: string[];
};

type Stay = { hotel: Hotel; room: Room; rooms: number; price: number };
/** A flight and its airport transfer. `at` is the pickup (arriving) or the time to leave the hotel (leaving). */
type Leg = { flight: Flight; transfer: Transfer; at: number; price: number };
type Visit = { day: string; attraction: Attraction; start: number; price: number };
type CityPackage = {
  city: string;
  stay: Stay;
  arrival: Leg;
  departure: Leg;
  visits: Visit[];
  total: number;
};
type CityResult = { city: string; package: CityPackage } | { city: string; failedAt: Stage };

export function buildPackage(request: HolidayRequest, catalog: Catalog): BuildOutcome {
  const ctx = contextFor(request, catalog);
  const results = ctx.country.cities.map((city) => buildForCity(city, ctx));
  const packages = results.flatMap((result) => ('package' in result ? [result.package] : []));
  if (packages.length === 0) return { status: 'NO_PACKAGE', reason: explain(results, ctx) };

  const withinBudget = packages.filter((p) => p.total <= request.budgetInr);
  const chosen = cheapest(withinBudget.length > 0 ? withinBudget : packages);
  return {
    status: withinBudget.length > 0 ? 'OK' : 'OVER_BUDGET',
    trip: writeTrip(chosen, ctx),
  };
}

function contextFor(request: HolidayRequest, catalog: Catalog): Context {
  const country = catalog.destinations.countries.find((c) => c.code === request.country);
  const departure = catalog.destinations.departure_cities.find(
    (d) => d.airport === request.departureAirport,
  );
  if (!country || !departure)
    throw new Error('buildPackage needs a request that passed checkRequest');

  const party = { adults: request.adults, children: request.childAges.length };
  return {
    catalog,
    request,
    party,
    travelers: travelersIn(party),
    departureCity: departure.city,
    country: { name: country.name, cities: country.cities.map((c) => c.name) },
    start: request.startDate,
    lastDay: addDays(request.startDate, request.nights),
    nights: Array.from({ length: request.nights }, (_, i) => addDays(request.startDate, i)),
    fullDays: Array.from({ length: request.nights - 1 }, (_, i) =>
      addDays(request.startDate, i + 1),
    ),
  };
}

/** The cheapest valid package that spends every night in `city`, or the step where that is impossible. */
function buildForCity(city: string, ctx: Context): CityResult {
  const { catalog, request, travelers } = ctx;
  const airports = (catalog.airportsServingCity.get(city) ?? []).map((a) => a.code);

  const arrivals = airports
    .flatMap(
      (code) => catalog.flightsByArrival.get(key(request.departureAirport, code, ctx.start)) ?? [],
    )
    .filter((f) => f.seats_left >= travelers);
  if (arrivals.length === 0) return { city, failedAt: 'arrival' };

  const returns = airports
    .flatMap(
      (code) =>
        catalog.flightsByDeparture.get(key(code, request.departureAirport, ctx.lastDay)) ?? [],
    )
    .filter((f) => f.seats_left >= travelers);
  if (returns.length === 0) return { city, failedAt: 'return' };

  const stays = staysIn(city, ctx);
  if (stays.length === 0) return { city, failedAt: 'room' };

  // One city has one hotel, so the arrival half and the return half do not affect each other: the cheapest of
  // each, per room option, gives the cheapest whole.
  let best: { stay: Stay; arrival: Leg; departure: Leg; cost: number } | undefined;
  for (const stay of stays) {
    const arrival = cheapestArrival(arrivals, stay, city, ctx);
    const departure = arrival && cheapestDeparture(returns, stay, city, ctx);
    if (!arrival || !departure) continue;
    const cost = stay.price + arrival.price + departure.price;
    if (!best || cost < best.cost) best = { stay, arrival, departure, cost };
  }
  if (!best) return { city, failedAt: 'transfer' };

  const visits = planVisits(city, ctx);
  if (!visits) return { city, failedAt: 'attractions' };

  const total = best.cost + visits.reduce((sum, visit) => sum + visit.price, 0);
  return {
    city,
    package: {
      city,
      stay: best.stay,
      arrival: best.arrival,
      departure: best.departure,
      visits,
      total,
    },
  };
}

/** Every room type in the city that fits the party with enough rooms free on every night. */
function staysIn(city: string, ctx: Context): Stay[] {
  const { catalog } = ctx;
  const stays: Stay[] = [];
  for (const hotel of catalog.hotelsByCity.get(city) ?? []) {
    for (const room of catalog.roomsByHotel.get(hotel.hotel_id) ?? []) {
      const rooms = roomsNeeded(room, ctx.party);
      if (rooms === null) continue;
      const free = ctx.nights.every(
        (night) => (catalog.roomsLeft.get(key(room.room_id, night)) ?? 0) >= rooms,
      );
      if (free)
        stays.push({ hotel, room, rooms, price: hotelPrice(room, rooms, ctx.nights.length) });
    }
  }
  return stays;
}

/** Airport transfers between `airport` and the hotel's area. `area: null` serves every area of the city. */
function transfersFor(airport: string, city: string, hotel: Hotel, ctx: Context): Transfer[] {
  return (ctx.catalog.airportTransfers.get(key(airport, city)) ?? []).filter(
    (t) => t.area === null || t.area === hotel.area,
  );
}

/** The cheapest arrival flight plus transfer to this hotel, picked up at the earliest valid time. */
function cheapestArrival(
  arrivals: Flight[],
  stay: Stay,
  city: string,
  ctx: Context,
): Leg | undefined {
  let best: Leg | undefined;
  for (const flight of arrivals) {
    const earliest = minutesOf(flight.arrival_local.slice(11)) + MIN_MINUTES_AFTER_LANDING;
    for (const transfer of transfersFor(flight.to, city, stay.hotel, ctx)) {
      const pickup = earliestInWindow(earliest, transfer.service_from, transfer.service_until);
      if (pickup === null) continue;
      const price = flightPrice(flight, ctx.party) + transferPrice(transfer, ctx.party);
      // On a tie, reach the hotel sooner.
      const reachesHotel = pickup + transfer.duration_minutes;
      if (
        !best ||
        price < best.price ||
        (price === best.price && reachesHotel < best.at + best.transfer.duration_minutes)
      ) {
        best = { flight, transfer, at: pickup, price };
      }
    }
  }
  return best;
}

/** The cheapest return flight plus transfer from this hotel, leaving the hotel at the latest valid time. */
function cheapestDeparture(
  returns: Flight[],
  stay: Stay,
  city: string,
  ctx: Context,
): Leg | undefined {
  let best: Leg | undefined;
  for (const flight of returns) {
    for (const transfer of transfersFor(flight.from, city, stay.hotel, ctx)) {
      const latest =
        minutesOf(flight.departure_local.slice(11)) -
        MIN_MINUTES_BEFORE_DEPARTURE -
        transfer.duration_minutes;
      const leave = latestInWindow(latest, transfer.service_from, transfer.service_until);
      if (leave === null) continue;
      const price = flightPrice(flight, ctx.party) + transferPrice(transfer, ctx.party);
      // On a tie, leave the hotel later.
      if (!best || price < best.price || (price === best.price && leave > best.at)) {
        best = { flight, transfer, at: leave, price };
      }
    }
  }
  return best;
}

/** One different attraction on every full day at the lowest total price, or null when the city cannot fill them all. */
function planVisits(city: string, ctx: Context): Visit[] | null {
  const attractions = ctx.catalog.attractionsByCity.get(city) ?? [];
  const startOfDay = minutesOf(VISITS_START_AT);

  const options = new Map<string, Visit[]>();
  for (const day of ctx.fullDays) {
    const weekday = weekdayOf(day);
    const fits = attractions.flatMap((attraction): Visit[] => {
      if (!attraction.open_days.includes(weekday)) return [];
      if (attraction.closed_dates?.includes(day)) return [];
      const [opens, closes] = windowOf(attraction.open_from, attraction.open_until);
      const start = Math.max(startOfDay, opens);
      if (start + attraction.visit_minutes > closes) return [];
      return [{ day, attraction, start, price: attractionPrice(attraction, ctx.party) }];
    });
    options.set(day, fits);
  }

  // Lists keep the catalog's order, so on equal prices the attraction listed first wins.
  const choices = new Map(
    [...options].map(([day, visits]) => [
      day,
      visits.map((v) => ({ id: v.attraction.attraction_id, cost: v.price })),
    ]),
  );
  const assignment = assignCheapest(ctx.fullDays, choices);
  if (!assignment) return null;
  return ctx.fullDays.map((day) =>
    options.get(day)!.find((visit) => visit.attraction.attraction_id === assignment.get(day))!,
  );
}

/** The first package wins a tie, so results repeat: cities keep the order of destinations.json. */
function cheapest(packages: CityPackage[]): CityPackage {
  return packages.reduce((best, p) => (p.total < best.total ? p : best));
}

/** The package in the shared trip format, items in journey order. */
function writeTrip(p: CityPackage, ctx: Context): PlannedTrip {
  const { request, party } = ctx;
  const items = [
    flightItem(p.arrival.flight, p.city, ctx),
    transferItem(p.arrival.transfer, p.city, ctx.start, p.arrival.at, ctx),
    hotelItem(p.stay, p.city, ctx),
    ...p.visits.map((visit) => attractionItem(visit, p.city, ctx)),
    transferItem(p.departure.transfer, p.city, ctx.lastDay, p.departure.at, ctx),
    flightItem(p.departure.flight, ctx.departureCity, ctx),
  ].map((item, index) => ({ item_id: `i${index + 1}`, ...item }));

  return {
    traveler: {
      name: null,
      home_airport: request.departureAirport,
      adults: party.adults,
      children: party.children,
      child_ages: request.childAges,
    },
    start_date: ctx.start,
    end_date: ctx.lastDay,
    country: ctx.country.name,
    budget_inr: request.budgetInr,
    total_inr: items.reduce((sum, item) => sum + item.price_inr, 0),
    status: 'PLANNED',
    items,
  };
}

type NewItem = Omit<TripItem, 'item_id'>;

function item(
  fields: Pick<
    NewItem,
    'type' | 'name' | 'city' | 'catalog_id' | 'start' | 'end' | 'room_id' | 'quantity' | 'price_inr'
  >,
): NewItem {
  return { ...fields, status: 'PLANNED', booking: null, sources: [], warnings: [] };
}

/** A flight's `city` is where it lands. Times keep the flight's own local times, without seconds. */
function flightItem(flight: Flight, city: string, ctx: Context): NewItem {
  return item({
    type: 'flight',
    name: `${flight.flight_number} ${flight.from} to ${flight.to}`,
    city,
    catalog_id: flight.flight_id,
    start: flight.departure_local.slice(0, 16),
    end: flight.arrival_local.slice(0, 16),
    room_id: null,
    quantity: ctx.travelers,
    price_inr: flightPrice(flight, ctx.party),
  });
}

function transferItem(
  transfer: Transfer,
  city: string,
  date: string,
  at: number,
  ctx: Context,
): NewItem {
  return item({
    type: 'transfer',
    name: transfer.name,
    city,
    catalog_id: transfer.transfer_id,
    start: localDateTime(date, at),
    end: localDateTime(date, at + transfer.duration_minutes),
    room_id: null,
    quantity: transferQuantity(transfer, ctx.party),
    price_inr: transferPrice(transfer, ctx.party),
  });
}

/** `start` is the check-in date and `end` the check-out date. */
function hotelItem(stay: Stay, city: string, ctx: Context): NewItem {
  return item({
    type: 'hotel',
    name: `${stay.hotel.name}, ${stay.room.name}`,
    city,
    catalog_id: stay.hotel.hotel_id,
    start: ctx.start,
    end: ctx.lastDay,
    room_id: stay.room.room_id,
    quantity: stay.rooms,
    price_inr: stay.price,
  });
}

function attractionItem(visit: Visit, city: string, ctx: Context): NewItem {
  return item({
    type: 'attraction',
    name: visit.attraction.name,
    city,
    catalog_id: visit.attraction.attraction_id,
    start: localDateTime(visit.day, visit.start),
    end: localDateTime(visit.day, visit.start + visit.attraction.visit_minutes),
    room_id: null,
    quantity: ctx.travelers,
    price_inr: visit.price,
  });
}

/** Why no package is possible, from the city that got furthest, in the traveler's words. */
function explain(results: CityResult[], ctx: Context): NoPackageReason {
  const failures = results.flatMap((result) => ('failedAt' in result ? [result] : []));
  const stage = STAGES[Math.max(...failures.map((f) => STAGES.indexOf(f.failedAt)))]!;
  const cities = failures.filter((f) => f.failedAt === stage).map((f) => f.city);
  const { departureCity, country, travelers } = ctx;
  const startDate = formatDate(ctx.start);
  const lastDay = formatDate(ctx.lastDay);

  switch (stage) {
    case 'arrival':
      return flightsIntoCountry(ctx).length === 0
        ? {
            code: 'NO_ARRIVAL_FLIGHT',
            message: `No flight from ${departureCity} lands in ${country.name} on ${startDate}.`,
          }
        : {
            code: 'NO_ARRIVAL_SEATS',
            message: `No flight from ${departureCity} landing in ${country.name} on ${startDate} has ${travelers} seats left.`,
          };
    case 'return': {
      const leaving = flightsOutOfCountry(ctx);
      const withSeats = leaving.filter((f) => f.seats_left >= travelers);
      if (leaving.length === 0) {
        return {
          code: 'NO_RETURN_FLIGHT',
          message: `No flight back to ${departureCity} leaves ${country.name} on ${lastDay}.`,
        };
      }
      if (withSeats.length === 0) {
        return {
          code: 'NO_RETURN_SEATS',
          message: `No flight back to ${departureCity} on ${lastDay} has ${travelers} seats left.`,
        };
      }
      const landingAt = flightsIntoCountry(ctx)
        .filter((f) => f.seats_left >= travelers)
        .map((f) => f.to);
      return {
        code: 'NO_COMMON_CITY',
        message:
          `On ${startDate} flights land only at ${either(landingAt)}, and on ${lastDay} flights back ` +
          `leave only from ${either(withSeats.map((f) => f.from))}. No city is served by both.`,
      };
    }
    case 'room':
      return {
        code: 'NO_ROOM',
        message: `No hotel in ${either(cities)} has rooms for ${partyText(ctx.party)} free on every night.`,
      };
    case 'transfer':
      return {
        code: 'NO_TRANSFER',
        message: `No airport transfer in ${either(cities)} runs at the times these flights need.`,
      };
    case 'attractions':
      return {
        code: 'NO_ATTRACTIONS',
        message: `Not enough different attractions are open in ${either(cities)} to fill every full day.`,
      };
  }
}

function countryAirports(ctx: Context): string[] {
  return unique(
    ctx.country.cities.flatMap((city) =>
      (ctx.catalog.airportsServingCity.get(city) ?? []).map((a) => a.code),
    ),
  );
}

function flightsIntoCountry(ctx: Context): Flight[] {
  return countryAirports(ctx).flatMap(
    (code) =>
      ctx.catalog.flightsByArrival.get(key(ctx.request.departureAirport, code, ctx.start)) ?? [],
  );
}

function flightsOutOfCountry(ctx: Context): Flight[] {
  return countryAirports(ctx).flatMap(
    (code) =>
      ctx.catalog.flightsByDeparture.get(key(code, ctx.request.departureAirport, ctx.lastDay)) ??
      [],
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

/** `["HND", "NRT"]` is `HND or NRT`. */
function either(values: string[]): string {
  const list = unique(values);
  return list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} or ${list.at(-1)}`;
}

function partyText(party: Party): string {
  const adults = `${party.adults} adult${party.adults === 1 ? '' : 's'}`;
  if (party.children === 0) return adults;
  return `${adults} and ${party.children} child${party.children === 1 ? '' : 'ren'}`;
}
