import type { HolidayRequest, NoPackageReason, Trip, TripItem } from '@bh/shared/holiday-package';
import { key, type Catalog } from '../../catalog/catalog.logic';
import type { Attraction, Flight, Hotel, Room, Transfer } from '../../catalog/catalog.schemas';
import { assignCheapest, earliestVisit } from './attractions.logic';
import { cityPlans, type CityPlan } from './plans.logic';
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
  departureAtOrAfter,
  earliestInWindow,
  formatDate,
  latestInWindow,
  localDateTime,
  minutesOf,
} from './time.logic';
import {
  HOPS_LEAVE_AT,
  MIN_MINUTES_AFTER_LANDING,
  MIN_MINUTES_BEFORE_DEPARTURE,
  VISITS_START_AT,
} from './travel-rules';

// Builds a package for a request that passed `checkRequest`: it prices every city plan and keeps the cheapest.
// ARCHITECTURE.md ("Building a package") explains each step.

export type PlannedTrip = Omit<Trip, 'trip_id'>;

export type BuildOutcome =
  | { status: 'OK' | 'OVER_BUDGET'; trip: PlannedTrip }
  | { status: 'NO_PACKAGE'; reason: NoPackageReason };

/** The steps a plan can fail at, in the order they are tried. The furthest one explains a NO_PACKAGE. */
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
};

/** One city of a plan: the dates the traveler sleeps there, and its full days (every one of those but the first). */
type Segment = { city: string; nights: string[]; fullDays: string[] };

type Stay = { hotel: Hotel; room: Room; rooms: number; price: number };
/** A flight and its airport transfer. `at` is the pickup (arriving) or the time to leave the hotel (leaving). */
type Leg = { flight: Flight; transfer: Transfer; at: number; price: number };
/** The train, bus or taxi to the next city, leaving at `at` on `day`, the day the traveler moves. */
type Hop = { transfer: Transfer; day: string; at: number; price: number };
type Visit = { day: string; attraction: Attraction; start: number; price: number };
/** One city of a package: its hotel, plus the arrival leg in the first city and the return leg in the last. */
type Stop = {
  segment: Segment;
  stay: Stay;
  arrival: Leg | null;
  departure: Leg | null;
  cost: number;
};
type PlanPackage = {
  stops: Stop[];
  /** The visits of each stop, in the same order. */
  visits: Visit[][];
  /** The moves between neighbouring stops. */
  hops: Hop[];
  total: number;
  /** When the traveler reaches the first hotel, in minutes after midnight on the start date. */
  reachesFirstHotel: number;
};
type PlanResult = { package: PlanPackage } | { failedAt: Stage; city: string };

export function buildPackage(request: HolidayRequest, catalog: Catalog): BuildOutcome {
  const ctx = contextFor(request, catalog);
  const plans = cityPlans(
    ctx.country.cities,
    request.nights,
    catalog.destinations.rules.min_nights_per_city,
    (from, to) => catalog.intercityTransfers.has(key(from, to)),
  );
  const results = plans.map((plan) => buildForPlan(plan, ctx));
  const packages = results.flatMap((result) => ('package' in result ? [result.package] : []));
  if (packages.length === 0) return { status: 'NO_PACKAGE', reason: explain(results, ctx) };

  // The cheapest package is within budget whenever any package is.
  const chosen = best(packages);
  return {
    status: chosen.total <= request.budgetInr ? 'OK' : 'OVER_BUDGET',
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
  };
}

/** The plan as dates: each city's nights follow the previous city's, from the start date. */
function segmentsOf(plan: CityPlan, start: string): Segment[] {
  let firstNight = 0;
  return plan.map(({ city, nights }) => {
    const dates = Array.from({ length: nights }, (_, i) => addDays(start, firstNight + i));
    firstNight += nights;
    return { city, nights: dates, fullDays: dates.slice(1) };
  });
}

/** The cheapest valid package for one city plan, or the step and the city where the plan is impossible. */
function buildForPlan(plan: CityPlan, ctx: Context): PlanResult {
  const segments = segmentsOf(plan, ctx.start);
  const first = segments[0]!;
  const last = segments.at(-1)!;

  const arrivals = arrivalsInto(first.city, ctx);
  if (arrivals.length === 0) return { failedAt: 'arrival', city: first.city };
  const returns = returnsFrom(last.city, ctx);
  if (returns.length === 0) return { failedAt: 'return', city: last.city };

  // No choice in one city changes the choices in another: a hotel matters only to its own city, and, in the first and
  // last city, to the airport transfer that must serve its area. Trains and buses run station to station. So the
  // cheapest stop in each city, added up, is the cheapest package for the plan, with no combinations to try.
  const stops: Stop[] = [];
  for (const segment of segments) {
    const stays = staysIn(segment, ctx);
    if (stays.length === 0) return { failedAt: 'room', city: segment.city };
    const stop = cheapestStop(
      segment,
      stays,
      segment === first ? arrivals : null,
      segment === last ? returns : null,
      ctx,
    );
    if (!stop) return { failedAt: 'transfer', city: segment.city };
    stops.push(stop);
  }

  const visits: Visit[][] = [];
  for (const segment of segments) {
    const planned = planVisits(segment, ctx);
    if (!planned) return { failedAt: 'attractions', city: segment.city };
    visits.push(planned);
  }

  const hops = segments.slice(1).map((segment, i) => cheapestHop(segments[i]!.city, segment, ctx));
  const total =
    sum(stops.map((stop) => stop.cost)) +
    sum(hops.map((hop) => hop.price)) +
    sum(visits.flat().map((visit) => visit.price));
  const arrival = stops[0]!.arrival!;
  return {
    package: {
      stops,
      visits,
      hops,
      total,
      reachesFirstHotel: arrival.at + arrival.transfer.duration_minutes,
    },
  };
}

/** Flights from home that land on the start date at an airport serving `city`, with a seat for everyone. */
function arrivalsInto(city: string, ctx: Context): Flight[] {
  const { catalog, request } = ctx;
  return (catalog.airportsServingCity.get(city) ?? [])
    .flatMap(
      (airport) =>
        catalog.flightsByArrival.get(key(request.departureAirport, airport.code, ctx.start)) ?? [],
    )
    .filter((f) => f.seats_left >= ctx.travelers);
}

/** Flights home that leave on the last day from an airport serving `city`, with a seat for everyone. */
function returnsFrom(city: string, ctx: Context): Flight[] {
  const { catalog, request } = ctx;
  return (catalog.airportsServingCity.get(city) ?? [])
    .flatMap(
      (airport) =>
        catalog.flightsByDeparture.get(key(airport.code, request.departureAirport, ctx.lastDay)) ??
        [],
    )
    .filter((f) => f.seats_left >= ctx.travelers);
}

/**
 * The cheapest stay in one city, together with the flight and airport transfer at each end of the trip that the city
 * touches: the first city takes the arrival, the last city the return, a one-city plan both. Null when no stay has an
 * airport transfer that runs at the flights' times.
 */
function cheapestStop(
  segment: Segment,
  stays: Stay[],
  arrivals: Flight[] | null,
  returns: Flight[] | null,
  ctx: Context,
): Stop | null {
  let best: Stop | null = null;
  for (const stay of stays) {
    const arrival = arrivals ? cheapestArrival(arrivals, stay, segment.city, ctx) : null;
    const departure = returns ? cheapestDeparture(returns, stay, segment.city, ctx) : null;
    if (arrival === undefined || departure === undefined) continue;
    const cost = stay.price + (arrival?.price ?? 0) + (departure?.price ?? 0);
    if (!best || cost < best.cost) best = { segment, stay, arrival, departure, cost };
  }
  return best;
}

/** Every room type in the segment's city that fits the party, with enough rooms free on each of its nights. */
function staysIn(segment: Segment, ctx: Context): Stay[] {
  const { catalog } = ctx;
  const stays: Stay[] = [];
  for (const hotel of catalog.hotelsByCity.get(segment.city) ?? []) {
    for (const room of catalog.roomsByHotel.get(hotel.hotel_id) ?? []) {
      const rooms = roomsNeeded(room, ctx.party);
      if (rooms === null) continue;
      const free = segment.nights.every(
        (night) => (catalog.roomsLeft.get(key(room.room_id, night)) ?? 0) >= rooms,
      );
      if (free)
        stays.push({ hotel, room, rooms, price: hotelPrice(room, rooms, segment.nights.length) });
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
function planVisits(segment: Segment, ctx: Context): Visit[] | null {
  const attractions = ctx.catalog.attractionsByCity.get(segment.city) ?? [];
  const startOfDay = minutesOf(VISITS_START_AT);

  const options = new Map<string, Visit[]>();
  for (const day of segment.fullDays) {
    const fits = attractions.flatMap((attraction): Visit[] => {
      const visit = earliestVisit(attraction, day, startOfDay);
      const price = attractionPrice(attraction, ctx.party);
      return visit ? [{ day, attraction, start: visit.start, price }] : [];
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
  const assignment = assignCheapest(segment.fullDays, choices);
  if (!assignment) return null;
  return segment.fullDays.map((day) =>
    options.get(day)!.find((visit) => visit.attraction.attraction_id === assignment.get(day))!,
  );
}

/**
 * The cheapest train, bus or taxi from `from` to the segment's city, on the segment's first day. On equal price, the
 * one that arrives sooner.
 */
function cheapestHop(from: string, segment: Segment, ctx: Context): Hop {
  const day = segment.nights[0]!;
  const preferred = minutesOf(HOPS_LEAVE_AT);
  let best: Hop | undefined;
  for (const transfer of ctx.catalog.intercityTransfers.get(key(from, segment.city)) ?? []) {
    const at = departureAtOrAfter(
      preferred,
      transfer.service_from,
      transfer.service_until,
      transfer.frequency_minutes ?? 1,
    );
    const price = transferPrice(transfer, ctx.party);
    const arrives = at + transfer.duration_minutes;
    if (
      !best ||
      price < best.price ||
      (price === best.price && arrives < best.at + best.transfer.duration_minutes)
    ) {
      best = { transfer, day, at, price };
    }
  }
  // Plans only join cities that a link in destinations.json connects, and a link lists at least one transfer.
  return best!;
}

/**
 * The cheapest package. On a tie: fewer cities (less packing and moving for a family), then the one that reaches its
 * first hotel sooner after the flight, then the plan listed first, so results repeat.
 */
function best(packages: PlanPackage[]): PlanPackage {
  return packages.reduce((winner, p) => {
    const order =
      p.total - winner.total ||
      p.stops.length - winner.stops.length ||
      p.reachesFirstHotel - winner.reachesFirstHotel;
    return order < 0 ? p : winner;
  });
}

/** The package in the shared trip format, items in journey order. */
function writeTrip(p: PlanPackage, ctx: Context): PlannedTrip {
  const { request, party } = ctx;
  const first = p.stops[0]!;
  const last = p.stops.at(-1)!;
  const arrival = first.arrival!;
  const departure = last.departure!;
  const items = [
    flightItem(arrival.flight, first.segment.city, ctx),
    transferItem(arrival.transfer, first.segment.city, ctx.start, arrival.at, ctx),
    ...p.stops.flatMap((stop, i) => {
      const hop = i > 0 ? p.hops[i - 1]! : null;
      return [
        // A move between cities belongs to the city it arrives in, as a flight does.
        ...(hop ? [transferItem(hop.transfer, stop.segment.city, hop.day, hop.at, ctx)] : []),
        hotelItem(stop.stay, stop.segment),
        ...p.visits[i]!.map((visit) => attractionItem(visit, stop.segment.city, ctx)),
      ];
    }),
    transferItem(departure.transfer, last.segment.city, ctx.lastDay, departure.at, ctx),
    flightItem(departure.flight, ctx.departureCity, ctx),
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

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
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

/** `start` is the check-in date (the city's first night) and `end` the check-out date (the day after its last). */
function hotelItem(stay: Stay, segment: Segment): NewItem {
  return item({
    type: 'hotel',
    name: `${stay.hotel.name}, ${stay.room.name}`,
    city: segment.city,
    catalog_id: stay.hotel.hotel_id,
    start: segment.nights[0]!,
    end: addDays(segment.nights.at(-1)!, 1),
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

/** Why no package is possible, from the plan that got furthest, in the traveler's words. */
function explain(results: PlanResult[], ctx: Context): NoPackageReason {
  const { departureCity, country, travelers, request } = ctx;
  const minNights = ctx.catalog.destinations.rules.min_nights_per_city;
  if (results.length === 0) {
    return {
      code: 'NO_CITY_PLAN',
      message: `${request.nights} nights is too short for any city: each city needs at least ${minNights} nights.`,
    };
  }
  const failures = results.flatMap((result) => ('failedAt' in result ? [result] : []));
  const stage = STAGES[Math.max(...failures.map((f) => STAGES.indexOf(f.failedAt)))]!;
  const cities = failures.filter((f) => f.failedAt === stage).map((f) => f.city);
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
      const why =
        request.nights < 2 * minNights
          ? `and ${request.nights} nights is too short for two cities: each needs at least ${minNights}.`
          : `and no plan of cities for ${request.nights} nights starts in a city served by one and ends in one served by the other.`;
      return {
        code: 'NO_COMMON_CITY',
        message:
          `On ${startDate} flights land only at ${either(landingAt)}, and on ${lastDay} flights back ` +
          `leave only from ${either(withSeats.map((f) => f.from))}. No city is served by both, ${why}`,
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
