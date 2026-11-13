import type {
  HolidayRequest,
  NoPackageReason,
  PackageLabel,
  Trip,
} from '@bh/shared/holiday-package';
import { key, type Catalog } from '../../catalog/catalog.logic';
import type { Attraction, Flight, Hotel, Room, Transfer } from '../../catalog/catalog.schemas';
import { cheapestTransferFromAirport, cheapestTransferToAirport } from './airport-transfers.logic';
import { assignCheapest, earliestVisit } from './attractions.logic';
import { cityPlans, type CityPlan } from './plans.logic';
import {
  attractionPrice,
  flightPrice,
  hotelPrice,
  transferPrice,
  travelersIn,
  type Party,
} from './pricing.logic';
import { roomsNeeded } from './rooms.logic';
import { addDays, departureAtOrAfter, formatDate, minutesOf } from './time.logic';
import { HOPS_LEAVE_AT, VISITS_START_AT } from './travel-rules';
import { attractionItem, flightItem, hotelItem, transferItem } from './trip-items.logic';

// Builds the packages for a request that passed `checkRequest`: it prices every city plan and offers the cheapest, the
// fastest and the best rated (G4). ARCHITECTURE.md ("Building a package") explains each step.

export type PlannedTrip = Omit<Trip, 'trip_id'>;

/** A package offered to the traveler, with the labels it earns (G4). */
export type BuiltOption = { labels: PackageLabel[]; trip: PlannedTrip };

/**
 * `trip` is the cheapest package; `options` lists every package offered, the cheapest first. When nothing fits the
 * budget only the cheapest is offered, labelled over budget (M8).
 */
export type BuildOutcome =
  | { status: 'OK' | 'OVER_BUDGET'; trip: PlannedTrip; options: BuiltOption[] }
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
  /** Each city's stays and visits for given nights, worked out once per request: every search asks for the same ones. */
  memo: Map<string, unknown>;
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
/** A city plan with its cheapest package. */
type Built = { plan: CityPlan; package: PlanPackage };

/**
 * Choices fixed before the search fills in the rest at the lowest price. The fastest search fixes the flights and the
 * move on each change day; the best-rated search fixes the hotel stars in each city.
 */
type Pinned = { arrival?: Flight; departure?: Flight; moves?: Transfer[]; stars?: number[] };

export function buildPackage(request: HolidayRequest, catalog: Catalog): BuildOutcome {
  const ctx = contextFor(request, catalog);
  const plans = cityPlans(
    ctx.country.cities,
    request.nights,
    catalog.destinations.rules.min_nights_per_city,
    (from, to) => catalog.intercityTransfers.has(key(from, to)),
  );
  const results = plans.map((plan) => buildForPlan(plan, ctx));
  const built = plans.flatMap((plan, i): Built[] => {
    const result = results[i]!;
    return 'package' in result ? [{ plan, package: result.package }] : [];
  });
  if (built.length === 0) return { status: 'NO_PACKAGE', reason: explain(results, ctx) };

  // The cheapest package is within budget whenever any package is. When none is, it is the only one offered.
  const cheapest = best(built.map((b) => b.package));
  if (cheapest.total > request.budgetInr) {
    const trip = writeTrip(cheapest, ctx);
    return { status: 'OVER_BUDGET', trip, options: [{ labels: ['CHEAPEST'], trip }] };
  }
  const options = labelled(
    [
      ['CHEAPEST', cheapest],
      ['FASTEST', fastest(built, cheapest, ctx)],
      ['BEST_RATED', bestRated(built, cheapest, ctx)],
    ],
    ctx,
  );
  return { status: 'OK', trip: options[0]!.trip, options };
}

/**
 * The package with the least travel time within budget (G4): both flights plus every move between cities. Only the
 * flights and the moves set the time, so each plan is searched once per flight pair and per mix of moves (the bus or
 * the taxi on a link that has both), with the rest at the lowest price. On equal time, the cheaper. The search starts
 * from the cheapest package, which is within budget.
 */
function fastest(built: Built[], cheapest: PlanPackage, ctx: Context): PlanPackage {
  let winner = cheapest;
  for (const { plan } of built) {
    const segments = segmentsOf(plan, ctx.start);
    const links = segments
      .slice(1)
      .map(
        (segment, i) =>
          ctx.catalog.intercityTransfers.get(key(segments[i]!.city, segment.city)) ?? [],
      );
    for (const arrival of arrivalsInto(segments[0]!.city, ctx)) {
      for (const departure of returnsFrom(segments.at(-1)!.city, ctx)) {
        for (const moves of combinations(links)) {
          const result = buildForPlan(plan, ctx, { arrival, departure, moves });
          if (!('package' in result) || result.package.total > ctx.request.budgetInr) continue;
          const order =
            travelMinutes(result.package) - travelMinutes(winner) ||
            cheaperFirst(result.package, winner);
          if (order < 0) winner = result.package;
        }
      }
    }
  }
  return winner;
}

/**
 * The package with the highest average hotel stars within budget (G4). Only the hotels set the stars, so each plan is
 * searched once per mix of star levels across its cities, with each city's stay the cheapest at its level and the rest
 * at the lowest price. On equal stars, the cheaper. The search starts from the cheapest package, which is within budget.
 */
function bestRated(built: Built[], cheapest: PlanPackage, ctx: Context): PlanPackage {
  let winner = cheapest;
  for (const { plan } of built) {
    const levels = segmentsOf(plan, ctx.start).map((segment) => [
      ...new Set(
        remembered('stays', segment, ctx, () => staysIn(segment, ctx)).map(
          (stay) => stay.hotel.stars,
        ),
      ),
    ]);
    for (const stars of combinations(levels)) {
      const result = buildForPlan(plan, ctx, { stars });
      if (!('package' in result) || result.package.total > ctx.request.budgetInr) continue;
      // The nights are the same in every plan, so comparing stars × nights compares the averages, without rounding.
      const order =
        starNights(winner) - starNights(result.package) || cheaperFirst(result.package, winner);
      if (order < 0) winner = result.package;
    }
  }
  return winner;
}

/** Writes each package once: a package that earns two labels is one option with both. */
function labelled(choices: [PackageLabel, PlanPackage][], ctx: Context): BuiltOption[] {
  const options: BuiltOption[] = [];
  for (const [label, chosen] of choices) {
    const trip = writeTrip(chosen, ctx);
    const items = JSON.stringify(trip.items);
    const same = options.find((option) => JSON.stringify(option.trip.items) === items);
    if (same) same.labels.push(label);
    else options.push({ labels: [label], trip });
  }
  return options;
}

/** Travel time as G4 counts it: both flights plus every move between cities. Airport transfers don't count. */
function travelMinutes(p: PlanPackage): number {
  return (
    p.stops[0]!.arrival!.flight.duration_minutes +
    p.stops.at(-1)!.departure!.flight.duration_minutes +
    sum(p.hops.map((hop) => hop.transfer.duration_minutes))
  );
}

/** Each hotel's stars times its nights, added up: the average stars per night, times the trip's nights. */
function starNights(p: PlanPackage): number {
  return sum(p.stops.map((stop) => stop.stay.hotel.stars * stop.segment.nights.length));
}

/** `work()` for this kind and segment, worked out on the first ask and remembered for the rest of the request. */
function remembered<T>(kind: string, segment: Segment, ctx: Context, work: () => T): T {
  const id = key(kind, segment.city, segment.nights[0]!, String(segment.nights.length));
  if (!ctx.memo.has(id)) ctx.memo.set(id, work());
  return ctx.memo.get(id) as T;
}

/** Every way to take one item from each list: `[[a, b], [c]]` gives `[a, c]` and `[b, c]`. */
function combinations<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>(
    (combos, list) => combos.flatMap((combo) => list.map((item) => [...combo, item])),
    [[]],
  );
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
    memo: new Map(),
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
function buildForPlan(plan: CityPlan, ctx: Context, pinned: Pinned = {}): PlanResult {
  const segments = segmentsOf(plan, ctx.start);
  const first = segments[0]!;
  const last = segments.at(-1)!;

  const arrivals = pinned.arrival ? [pinned.arrival] : arrivalsInto(first.city, ctx);
  if (arrivals.length === 0) return { failedAt: 'arrival', city: first.city };
  const returns = pinned.departure ? [pinned.departure] : returnsFrom(last.city, ctx);
  if (returns.length === 0) return { failedAt: 'return', city: last.city };

  // No choice in one city changes the choices in another: a hotel matters only to its own city, and, in the first and
  // last city, to the airport transfer that must serve its area. Trains and buses run station to station. So the
  // cheapest stop in each city, added up, is the cheapest package for the plan, with no combinations to try.
  const stops: Stop[] = [];
  for (const [i, segment] of segments.entries()) {
    const stays = remembered('stays', segment, ctx, () => staysIn(segment, ctx)).filter(
      (stay) => !pinned.stars || stay.hotel.stars === pinned.stars[i],
    );
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
    const planned = remembered('visits', segment, ctx, () => planVisits(segment, ctx));
    if (!planned) return { failedAt: 'attractions', city: segment.city };
    visits.push(planned);
  }

  const hops = segments
    .slice(1)
    .map((segment, i) =>
      pinned.moves
        ? hopBy(pinned.moves[i]!, segment, ctx)
        : cheapestHop(segments[i]!.city, segment, ctx),
    );
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
    const arrival = arrivals ? cheapestArrival(arrivals, stay, ctx) : null;
    const departure = returns ? cheapestDeparture(returns, stay, ctx) : null;
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

/**
 * The cheapest arrival flight plus the transfer from its airport to this hotel. Each flight brings its own cheapest
 * transfer, so comparing flight + transfer per flight finds the cheapest pair. On a tie, reach the hotel sooner.
 */
function cheapestArrival(arrivals: Flight[], stay: Stay, ctx: Context): Leg | undefined {
  let best: Leg | undefined;
  for (const flight of arrivals) {
    const pick = cheapestTransferFromAirport(flight, stay.hotel, ctx.catalog, ctx.party);
    if (!pick) continue;
    const price = flightPrice(flight, ctx.party) + pick.price;
    const reachesHotel = pick.at + pick.transfer.duration_minutes;
    if (
      !best ||
      price < best.price ||
      (price === best.price && reachesHotel < best.at + best.transfer.duration_minutes)
    ) {
      best = { flight, transfer: pick.transfer, at: pick.at, price };
    }
  }
  return best;
}

/** The cheapest return flight plus the transfer from this hotel to its airport. On a tie, leave the hotel later. */
function cheapestDeparture(returns: Flight[], stay: Stay, ctx: Context): Leg | undefined {
  let best: Leg | undefined;
  for (const flight of returns) {
    const pick = cheapestTransferToAirport(flight, stay.hotel, ctx.catalog, ctx.party);
    if (!pick) continue;
    const price = flightPrice(flight, ctx.party) + pick.price;
    if (!best || price < best.price || (price === best.price && pick.at > best.at)) {
      best = { flight, transfer: pick.transfer, at: pick.at, price };
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
  let best: Hop | undefined;
  for (const transfer of ctx.catalog.intercityTransfers.get(key(from, segment.city)) ?? []) {
    const hop = hopBy(transfer, segment, ctx);
    const arrives = hop.at + transfer.duration_minutes;
    if (
      !best ||
      hop.price < best.price ||
      (hop.price === best.price && arrives < best.at + best.transfer.duration_minutes)
    ) {
      best = hop;
    }
  }
  // Plans only join cities that a link in destinations.json connects, and a link lists at least one transfer.
  return best!;
}

/** The move to the segment's city by `transfer`, on the segment's first day, at the first departure at or after 10:00. */
function hopBy(transfer: Transfer, segment: Segment, ctx: Context): Hop {
  const at = departureAtOrAfter(
    minutesOf(HOPS_LEAVE_AT),
    transfer.service_from,
    transfer.service_until,
    transfer.frequency_minutes ?? 1,
  );
  return { transfer, day: segment.nights[0]!, at, price: transferPrice(transfer, ctx.party) };
}

/**
 * The cheapest package. On a tie: fewer cities (less packing and moving for a family), then the one that reaches its
 * first hotel sooner after the flight, then the plan listed first, so results repeat.
 */
function best(packages: PlanPackage[]): PlanPackage {
  return packages.reduce((winner, p) => (cheaperFirst(p, winner) < 0 ? p : winner));
}

/** Negative when `a` comes first: cheaper, then fewer cities, then the first hotel reached sooner. */
function cheaperFirst(a: PlanPackage, b: PlanPackage): number {
  return (
    a.total - b.total ||
    a.stops.length - b.stops.length ||
    a.reachesFirstHotel - b.reachesFirstHotel
  );
}

/** The package in the shared trip format, items in journey order. */
function writeTrip(p: PlanPackage, ctx: Context): PlannedTrip {
  const { request, party } = ctx;
  const first = p.stops[0]!;
  const last = p.stops.at(-1)!;
  const arrival = first.arrival!;
  const departure = last.departure!;
  const items = [
    flightItem(arrival.flight, first.segment.city, party),
    transferItem(arrival.transfer, first.segment.city, ctx.start, arrival.at, party),
    ...p.stops.flatMap((stop, i) => {
      const hop = i > 0 ? p.hops[i - 1]! : null;
      const { segment, stay } = stop;
      return [
        // A move between cities belongs to the city it arrives in, as a flight does.
        ...(hop ? [transferItem(hop.transfer, segment.city, hop.day, hop.at, party)] : []),
        // Check-in on the city's first night, check-out the day after its last.
        hotelItem(
          stay.hotel,
          stay.room,
          stay.rooms,
          segment.nights[0]!,
          addDays(segment.nights.at(-1)!, 1),
        ),
        ...p.visits[i]!.map((visit) =>
          attractionItem(visit.attraction, visit.day, visit.start, party),
        ),
      ];
    }),
    transferItem(departure.transfer, last.segment.city, ctx.lastDay, departure.at, party),
    flightItem(departure.flight, ctx.departureCity, party),
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
