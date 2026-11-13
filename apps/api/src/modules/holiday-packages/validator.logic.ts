import type { Trip, TripItem } from '@bh/shared/holiday-package';
import {
  RULE_IDS,
  RULE_TITLES,
  type RuleId,
  type TripCheck,
  type TripProblem,
} from '@bh/shared/trip-check';
import { key, type Catalog } from '../catalog/catalog.logic';
import type { Attraction, Flight, Hotel, Room, Transfer } from '../catalog/catalog.schemas';
import { MIN_MINUTES_AFTER_LANDING, MIN_MINUTES_BEFORE_DEPARTURE } from './travel-rules';

// The validator: checks a finished package against every travel rule in §4 of the statement.
//
// It is written from the statement and DATA_DICTIONARY.md, not from the builder, and imports none of the builder's
// helpers (prices, rooms, times). So it is a second, independent check: a mistake in one is caught by the other.
/** A package to check. No rule depends on the id, so a package that is not saved yet can be checked too. */
export type TripToCheck = Omit<Trip, 'trip_id'>;

/** Every rule the package breaks. An empty list means the package is valid. */
export function validateTrip(trip: TripToCheck, catalog: Catalog): TripProblem[] {
  const problems: TripProblem[] = [];
  const ctx: Context = {
    trip,
    catalog,
    report: (rule, message, item) => {
      problems.push({ rule, itemId: item?.item_id ?? null, message });
    },
    adults: trip.traveler.adults,
    children: trip.traveler.child_ages.length,
    travelers: trip.traveler.adults + trip.traveler.child_ages.length,
    country: catalog.destinations.countries.find((c) => c.name === trip.country),
  };

  checkFormat(ctx);
  checkDates(ctx);
  const stays = checkHotels(ctx);
  checkCities(ctx, stays);
  checkRooms(ctx, stays);
  const flights = checkFlights(ctx, stays);
  const reachedFirstHotel = checkAirportTransfers(ctx, stays, flights);
  const reachedHotelOn = checkCityTransfers(ctx, stays);
  checkAttractions(ctx, stays, reachedFirstHotel, reachedHotelOn);
  checkPrices(ctx);
  return problems;
}

/** Every rule with whether it passes, for the rules panel. */
export function checkTrip(trip: TripToCheck, catalog: Catalog): TripCheck {
  const problems = validateTrip(trip, catalog);
  return {
    rules: RULE_IDS.map((id) => ({
      id,
      title: RULE_TITLES[id],
      passed: !problems.some((p) => p.rule === id),
    })),
    problems,
  };
}

type Context = {
  trip: TripToCheck;
  catalog: Catalog;
  report: (rule: RuleId, message: string, item?: TripItem) => void;
  adults: number;
  children: number;
  travelers: number;
  country: Catalog['destinations']['countries'][number] | undefined;
};

/** A hotel item with its catalog records. `from` is the first night, `to` the check-out date. */
type Stay = { item: TripItem; city: string; hotel: Hotel; room: Room; from: string; to: string };
type FlightLeg = { item: TripItem; flight: Flight };
type TransferLeg = { item: TripItem; transfer: Transfer };
type AttractionLeg = { item: TripItem; attraction: Attraction };
type Flights = { arrival?: FlightLeg; departure?: FlightLeg };

const RESERVATION_NUMBER = /^[1-9]\d{9}$/;

// The trip format, and that every item names a real catalog record.

function checkFormat({ trip, catalog, report }: Context) {
  const ids = new Set<string>();
  for (const item of trip.items) {
    if (ids.has(item.item_id)) report('format', `The item id ${item.item_id} is used twice`, item);
    ids.add(item.item_id);

    if (!recordExists(item, catalog)) {
      report('format', `${item.catalog_id} is not a ${item.type} in the catalog`, item);
    }
    if (item.sources.length > 0) report('format', '`sources` must be an empty list', item);
    if ((item.type === 'hotel') !== (item.room_id !== null)) {
      report('format', '`room_id` is set on hotel items, and only on them', item);
    }
    if (item.status !== trip.status) {
      report('format', `The item is ${item.status} but the package is ${trip.status}`, item);
    }
    if (trip.status === 'BOOKED' && !RESERVATION_NUMBER.test(item.booking?.reference ?? '')) {
      report('format', 'A booked item carries the 10-digit reservation number', item);
    }
    if (trip.status === 'PLANNED' && item.booking !== null) {
      report('format', 'Only a booked item has a booking', item);
    }
  }
  if (trip.status === 'BOOKED') {
    const references = new Set(trip.items.map((item) => item.booking?.reference));
    if (references.size > 1) report('format', 'Every item carries the same reservation number');
  }

  const { traveler } = trip;
  if (traveler.adults < 1) report('format', 'At least one adult travels');
  if (traveler.children !== traveler.child_ages.length) {
    report(
      'format',
      `\`children\` is ${traveler.children}, but ${traveler.child_ages.length} ages are listed`,
    );
  }
  if (traveler.child_ages.some((age) => !Number.isInteger(age) || age < 0 || age > 17)) {
    report('format', 'A child is aged 0 to 17');
  }
}

function recordExists(item: TripItem, catalog: Catalog): boolean {
  switch (item.type) {
    case 'flight':
      return catalog.flights.has(item.catalog_id);
    case 'hotel':
      return catalog.hotels.has(item.catalog_id);
    case 'transfer':
      return catalog.transfers.has(item.catalog_id);
    case 'attraction':
      return catalog.attractions.has(item.catalog_id);
  }
}

// Dates: the number of nights, inside the window the data covers. The limits come from destinations.json.

function checkDates({ trip, catalog, report }: Context) {
  const { min_nights, max_nights, data_window } = catalog.destinations.rules;
  const nights = daysBetween(trip.start_date, trip.end_date);
  if (nights < min_nights || nights > max_nights) {
    report(
      'trip-dates',
      `The trip has ${nights} nights. It must have ${min_nights} to ${max_nights}`,
    );
  }
  if (trip.start_date < data_window.first_night) {
    report('trip-dates', `The first night is before ${data_window.first_night}`);
  }
  if (trip.end_date > data_window.last_departure) {
    report('trip-dates', `The return is after ${data_window.last_departure}`);
  }
}

// Hotels: one per city, one room type, and together they cover every night from the start date to the night before
// the last day, with no gap and no overlap.

function checkHotels({ trip, catalog, report }: Context): Stay[] {
  const stays: Stay[] = [];
  for (const item of trip.items.filter((i) => i.type === 'hotel').sort(byStart)) {
    const hotel = catalog.hotels.get(item.catalog_id);
    if (!hotel) continue; // reported by checkFormat
    const room = item.room_id === null ? undefined : catalog.rooms.get(item.room_id);
    if (!room || room.hotel_id !== hotel.hotel_id) {
      report('hotels', `${item.room_id} is not a room type of ${hotel.name}`, item);
      continue;
    }
    if (item.city !== hotel.city) {
      report('hotels', `${hotel.name} is in ${hotel.city}, not ${item.city}`, item);
    }
    if (item.end === null || !isDate(item.start) || !isDate(item.end) || item.end <= item.start) {
      report('hotels', 'A stay runs from a check-in date to a later check-out date', item);
      continue;
    }
    stays.push({ item, city: hotel.city, hotel, room, from: item.start, to: item.end });
  }

  if (stays.length === 0) {
    report('hotels', 'The package has no hotel');
    return stays;
  }
  if (stays[0].from !== trip.start_date) {
    report(
      'hotels',
      `The first hotel night must be the start date, ${trip.start_date}`,
      stays[0].item,
    );
  }
  for (let i = 1; i < stays.length; i++) {
    const [before, after] = [stays[i - 1], stays[i]];
    if (after.from > before.to) {
      report('hotels', `No hotel for the nights from ${before.to} to ${after.from}`, after.item);
    } else if (after.from < before.to) {
      report('hotels', `Two hotels on the night of ${after.from}`, after.item);
    }
  }
  const last = stays[stays.length - 1];
  if (last.to !== trip.end_date) {
    report('hotels', `The last check-out must be the last day, ${trip.end_date}`, last.item);
  }
  return stays;
}

// Cities: all in the country, each once, each with enough nights in a row.

function checkCities({ trip, catalog, report, country }: Context, stays: Stay[]) {
  if (!country) {
    report('cities', `${trip.country} is not a destination in the data`);
    return;
  }
  const cities = country.cities.map((c) => c.name);
  const min = catalog.destinations.rules.min_nights_per_city;
  const seen = new Set<string>();
  for (const stay of stays) {
    if (!cities.includes(stay.city)) {
      report('cities', `${stay.city} is not in ${trip.country}`, stay.item);
    }
    if (seen.has(stay.city)) {
      report('cities', `${stay.city} appears twice. Each city has one stay`, stay.item);
    }
    seen.add(stay.city);
    const nights = daysBetween(stay.from, stay.to);
    if (nights < min) {
      report(
        'cities',
        `${stay.city} has ${nights} night(s). Each city needs at least ${min} in a row`,
        stay.item,
      );
    }
  }
  // A flight's city is checked with the flights: the return flight's city is the home city.
  for (const item of trip.items) {
    if (item.type !== 'flight' && item.type !== 'hotel' && !cities.includes(item.city)) {
      report('cities', `${item.city} is not in ${trip.country}`, item);
    }
  }
}

// Rooms: k rooms fit when adults ≤ k × max_adults, travelers ≤ k × (max_adults + max_children) and adults ≥ k,
// and rooms_left ≥ k on every night of the stay.

function checkRooms({ catalog, report, adults, travelers }: Context, stays: Stay[]) {
  for (const { item, room, from, to } of stays) {
    const k = item.quantity;
    const fits =
      adults <= k * room.max_adults &&
      travelers <= k * (room.max_adults + room.max_children) &&
      adults >= k;
    if (!fits) {
      report(
        'rooms',
        `${k} × ${room.name} can't sleep ${adults} adults and ${travelers - adults} children`,
        item,
      );
    }
    for (const night of nightsOf(from, to)) {
      const left = catalog.roomsLeft.get(key(room.room_id, night)) ?? 0;
      if (left < k) {
        report(
          'rooms',
          `Only ${left} ${room.name} left on the night of ${night}, and ${k} are needed`,
          item,
        );
      }
    }
  }
}

// Flights: one arrival flight from home, landing on the start date at an airport serving the first city; one return
// flight home, leaving on the last day from an airport serving the last city. Every traveler has a seat.

function checkFlights(ctx: Context, stays: Stay[]): Flights {
  const { trip, catalog, report, travelers } = ctx;
  const items = trip.items.filter((i) => i.type === 'flight').sort(byStart);
  if (items.length !== 2) {
    report(
      'flights',
      `A package has one arrival and one return flight, not ${items.length} flights`,
    );
    return {};
  }
  const legs: FlightLeg[] = [];
  for (const item of items) {
    const flight = catalog.flights.get(item.catalog_id);
    if (!flight) return {}; // reported by checkFormat
    legs.push({ item, flight });
    if (
      item.start !== minutePrecision(flight.departure_local) ||
      item.end !== minutePrecision(flight.arrival_local)
    ) {
      report(
        'flights',
        `${flight.flight_number} leaves at ${flight.departure_local} and lands at ${flight.arrival_local}`,
        item,
      );
    }
    if (flight.seats_left < travelers) {
      report(
        'seats',
        `${flight.flight_number} has ${flight.seats_left} seats left for ${travelers} travelers`,
        item,
      );
    }
  }

  const [arrival, departure] = legs;
  const home = trip.traveler.home_airport;
  const homeCity = catalog.destinations.departure_cities.find((d) => d.airport === home)?.city;
  const first = stays[0]?.city;
  const last = stays[stays.length - 1]?.city;

  if (arrival.flight.from !== home) {
    report('flights', `The arrival flight must leave from ${home}`, arrival.item);
  }
  if (arrival.flight.arrival_local.slice(0, 10) !== trip.start_date) {
    report(
      'flights',
      `The arrival flight must land on the start date, ${trip.start_date}`,
      arrival.item,
    );
  }
  if (first && !serves(arrival.flight.to, first, catalog)) {
    report('flights', `${arrival.flight.to} doesn't serve ${first}, the first city`, arrival.item);
  }
  if (first && arrival.item.city !== first) {
    report('flights', `A flight's city is where it lands: ${first}`, arrival.item);
  }

  if (departure.flight.to !== home) {
    report('flights', `The return flight must fly to ${home}`, departure.item);
  }
  if (departure.flight.departure_local.slice(0, 10) !== trip.end_date) {
    report(
      'flights',
      `The return flight must leave on the last day, ${trip.end_date}`,
      departure.item,
    );
  }
  if (last && !serves(departure.flight.from, last, catalog)) {
    report(
      'flights',
      `${departure.flight.from} doesn't serve ${last}, the last city`,
      departure.item,
    );
  }
  if (homeCity && departure.item.city !== homeCity) {
    report('flights', `A flight's city is where it lands: ${homeCity}`, departure.item);
  }
  return { arrival, departure };
}

function serves(airport: string, city: string, catalog: Catalog): boolean {
  return catalog.airports.get(airport)?.serves_cities?.includes(city) ?? false;
}

// Airport transfers: one from the arrival airport to the first hotel, one from the last hotel to the return airport.
// Pickup ≥ landing + 60 min. At the airport ≥ 180 min before departure. Pickup and leaving inside the service hours.
// Returns when the traveler reaches the first hotel, or null if that isn't known.

function checkAirportTransfers(ctx: Context, stays: Stay[], flights: Flights): number | null {
  const { report } = ctx;
  const legs = transferLegs(ctx).filter((l) => l.transfer.airport !== null);
  if (legs.length !== 2) {
    report(
      'airport-transfers',
      `A package has one transfer from the airport and one back to it, not ${legs.length}`,
    );
    return null;
  }
  const [toHotel, toAirport] = legs;
  const firstStay = stays[0];
  const lastStay = stays[stays.length - 1];
  if (!isDateTime(toHotel.item.start) || !isDateTime(toAirport.item.start)) {
    report('airport-transfers', 'An airport transfer needs a pickup date and time');
    return null;
  }

  if (flights.arrival && firstStay) {
    checkServesStay(ctx, toHotel, flights.arrival.flight.to, firstStay);
    const landing = stamp(flights.arrival.flight.arrival_local);
    if (stamp(toHotel.item.start) < landing + MIN_MINUTES_AFTER_LANDING) {
      report(
        'airport-transfers',
        `The pickup must be at least ${MIN_MINUTES_AFTER_LANDING} minutes after landing at ${clockOf(landing)}`,
        toHotel.item,
      );
    }
  }
  if (flights.departure && lastStay) {
    checkServesStay(ctx, toAirport, flights.departure.flight.from, lastStay);
    const atAirport = stamp(toAirport.item.start) + toAirport.transfer.duration_minutes;
    const departs = stamp(flights.departure.flight.departure_local);
    if (atAirport > departs - MIN_MINUTES_BEFORE_DEPARTURE) {
      report(
        'airport-transfers',
        `The traveler reaches the airport at ${clockOf(atAirport)}: at least ${MIN_MINUTES_BEFORE_DEPARTURE} minutes before the ${clockOf(departs)} flight is needed`,
        toAirport.item,
      );
    }
  }
  for (const leg of [toHotel, toAirport]) {
    checkServiceHours(ctx, 'airport-transfers', leg);
    checkTransferEnd(ctx, 'airport-transfers', leg);
  }
  return stamp(toHotel.item.start) + toHotel.transfer.duration_minutes;
}

/** The transfer runs at the flight's airport, in the stay's city, and serves the hotel's area. */
function checkServesStay({ report }: Context, leg: TransferLeg, airport: string, stay: Stay) {
  const { transfer, item } = leg;
  if (transfer.airport !== airport) {
    report(
      'airport-transfers',
      `${transfer.name} runs at ${transfer.airport}, not ${airport}`,
      item,
    );
  }
  if (
    transfer.city !== stay.city ||
    (transfer.area !== null && transfer.area !== stay.hotel.area)
  ) {
    report(
      'airport-transfers',
      `${transfer.name} doesn't serve ${stay.hotel.name} (${stay.hotel.area}, ${stay.city})`,
      item,
    );
  }
}

// Transfers between cities: on each city-change day, exactly one transfer from the old city to the new one, from that
// link's transfer_ids, inside its service hours and on its timetable. City taxis and buses are optional.
// Returns, per city-change day, when the traveler reaches the new hotel, or null if they don't (see below).

function checkCityTransfers(ctx: Context, stays: Stay[]): Map<string, number | null> {
  const { report, country } = ctx;
  const reached = new Map<string, number | null>();
  const legs = transferLegs(ctx).filter((l) => l.transfer.airport === null);
  const between = legs.filter((l) => l.transfer.from_city && l.transfer.to_city);
  const inCity = legs.filter(
    (l) => l.transfer.type === 'CITY_TAXI' || l.transfer.type === 'CITY_BUS',
  );
  const used = new Set<TransferLeg>();

  for (let i = 1; i < stays.length; i++) {
    const from = stays[i - 1].city;
    const to = stays[i].city;
    const day = stays[i].from;
    const link = country?.links.find((l) => l.from_city === from && l.to_city === to);
    if (!link) {
      report('city-transfers', `No transfer goes from ${from} to ${to} in the data`, stays[i].item);
      continue;
    }
    const matches = between.filter(
      (l) =>
        l.transfer.from_city === from &&
        l.transfer.to_city === to &&
        l.item.start.slice(0, 10) === day,
    );
    matches.forEach((m) => used.add(m));
    if (matches.length !== 1) {
      report(
        'city-transfers',
        `On ${day} the traveler moves from ${from} to ${to}: one transfer between them is needed that day, not ${matches.length}`,
        stays[i].item,
      );
      continue;
    }
    const leg = matches[0];
    if (!link.transfer_ids.includes(leg.transfer.transfer_id)) {
      report(
        'city-transfers',
        `${leg.transfer.name} is not one of the ${from}–${to} transfers`,
        leg.item,
      );
    }
    if (!isDateTime(leg.item.start)) {
      report('city-transfers', 'A transfer needs a departure date and time', leg.item);
      continue;
    }
    checkServiceHours(ctx, 'city-transfers', leg);
    checkTimetable(ctx, leg);
    checkTransferEnd(ctx, 'city-transfers', leg);

    // The traveler has reached the city when they reach the hotel (mentor, 13 Nov). A door-to-door taxi arrives at
    // the hotel. A train or bus arrives at a station, so a visit that day needs the station taxi first.
    const arrives = stamp(leg.item.start) + leg.transfer.duration_minutes;
    if (leg.transfer.door_to_door) {
      reached.set(day, arrives);
    } else {
      const taxi = inCity.find(
        (l) =>
          l.transfer.city === to &&
          isDateTime(l.item.start) &&
          l.item.start.slice(0, 10) === day &&
          stamp(l.item.start) >= arrives,
      );
      reached.set(day, taxi ? stamp(taxi.item.start) + taxi.transfer.duration_minutes : null);
    }
  }

  for (const leg of between) {
    if (!used.has(leg)) {
      report(
        'city-transfers',
        `${leg.transfer.name} is not on a day the traveler changes city`,
        leg.item,
      );
    }
  }
  const stayCities = new Set(stays.map((s) => s.city));
  for (const leg of inCity) {
    if (!stayCities.has(leg.transfer.city ?? '')) {
      report(
        'city-transfers',
        `${leg.transfer.name} is in a city the traveler doesn't stay in`,
        leg.item,
      );
    }
    if (!isDateTime(leg.item.start)) continue;
    checkServiceHours(ctx, 'city-transfers', leg);
    checkTransferEnd(ctx, 'city-transfers', leg);
  }
  return reached;
}

/** Trains and intercity buses leave every `frequency_minutes`, counted from the start of the service hours. */
function checkTimetable({ report }: Context, { item, transfer }: TransferLeg) {
  if (!transfer.frequency_minutes) return;
  const since =
    (minutesOfDay(item.start.slice(11, 16)) - minutesOfDay(transfer.service_from) + DAY) % DAY;
  if (since % transfer.frequency_minutes !== 0) {
    report(
      'city-transfers',
      `${transfer.name} leaves every ${transfer.frequency_minutes} minutes from ${transfer.service_from}, not at ${item.start.slice(11, 16)}`,
      item,
    );
  }
}

// Attractions: in the city of that night's hotel, open that weekday and date, the whole visit inside the opening
// hours, no overlaps on a day, each at most once. Every full day has at least one, the last day none. On the arrival
// day and a city-change day they are optional and start after the traveler reaches the hotel.

function checkAttractions(
  ctx: Context,
  stays: Stay[],
  reachedFirstHotel: number | null,
  reachedHotelOn: Map<string, number | null>,
) {
  const { trip, catalog, report } = ctx;
  const visits: AttractionLeg[] = [];
  for (const item of trip.items.filter((i) => i.type === 'attraction').sort(byStart)) {
    const attraction = catalog.attractions.get(item.catalog_id);
    if (!attraction) continue; // reported by checkFormat
    if (!isDateTime(item.start)) {
      report('attractions', 'A visit needs a start date and time', item);
      continue;
    }
    visits.push({ item, attraction });
  }

  const seen = new Set<string>();
  for (const { item, attraction: a } of visits) {
    if (seen.has(a.attraction_id)) report('attractions', `${a.name} is in the package twice`, item);
    seen.add(a.attraction_id);

    const day = item.start.slice(0, 10);
    if (day === trip.end_date) {
      report('attraction-days', `No visits on the last day: ${a.name}`, item);
      continue;
    }
    if (day < trip.start_date || day > trip.end_date) {
      report('attraction-days', `${a.name} is outside the trip`, item);
      continue;
    }
    if (item.city !== a.city)
      report('attractions', `${a.name} is in ${a.city}, not ${item.city}`, item);
    const stay = stays.find((s) => s.from <= day && day < s.to);
    if (stay && stay.city !== a.city) {
      report(
        'attractions',
        `${a.name} is in ${a.city}, but that night's hotel is in ${stay.city}`,
        item,
      );
    }

    const weekday = weekdayOf(day);
    if (!a.open_days.includes(weekday))
      report('attractions', `${a.name} is closed on ${weekday}`, item);
    if (a.closed_dates?.includes(day)) report('attractions', `${a.name} is closed on ${day}`, item);
    const start = minutesOfDay(item.start.slice(11, 16));
    const [opens, closes] = windowOf(a.open_from, a.open_until);
    if (start < opens || start + a.visit_minutes > closes) {
      report(
        'attractions',
        `A ${a.visit_minutes}-minute visit from ${item.start.slice(11, 16)} doesn't fit the opening hours ${a.open_from}–${a.open_until}`,
        item,
      );
    }
    if (
      item.end === null ||
      !isDateTime(item.end) ||
      stamp(item.end) !== stamp(item.start) + a.visit_minutes
    ) {
      report('attractions', `The visit ends ${a.visit_minutes} minutes after it starts`, item);
    }

    const reached = day === trip.start_date ? reachedFirstHotel : reachedHotelOn.get(day);
    if (reached === null && reachedHotelOn.has(day)) {
      report('attractions', `On ${day} a visit needs the station taxi to the hotel first`, item);
    } else if (reached !== null && reached !== undefined && stamp(item.start) < reached) {
      report(
        'attractions',
        `${a.name} starts before the traveler reaches the hotel at ${clockOf(reached)}`,
        item,
      );
    }
  }

  for (let i = 1; i < visits.length; i++) {
    const [before, after] = [visits[i - 1], visits[i]];
    const beforeEnds = stamp(before.item.start) + before.attraction.visit_minutes;
    if (stamp(after.item.start) < beforeEnds) {
      report(
        'attractions',
        `${after.attraction.name} starts before ${before.attraction.name} ends`,
        after.item,
      );
    }
  }

  const changeDays = new Set(stays.slice(1).map((s) => s.from));
  for (const day of nightsOf(addDays(trip.start_date, 1), trip.end_date)) {
    if (changeDays.has(day)) continue;
    if (!visits.some((v) => v.item.start.slice(0, 10) === day)) {
      report(
        'attraction-days',
        `${day} is a full day with no visit. Every full day keeps at least one`,
      );
    }
  }
}

// Prices (§4), all whole INR. The total is the sum of the parts.

function checkPrices(ctx: Context) {
  const { trip, report } = ctx;
  let sum = 0;
  for (const item of trip.items) {
    sum += item.price_inr;
    const expected = expectedPrice(item, ctx);
    if (!expected) continue;
    if (expected.quantity !== null && item.quantity !== expected.quantity) {
      report('prices', `The quantity must be ${expected.quantity}, not ${item.quantity}`, item);
    }
    if (item.price_inr !== expected.price) {
      report(
        'prices',
        `The price must be ${inr(expected.price)}, not ${inr(item.price_inr)}`,
        item,
      );
    }
  }
  if (trip.total_inr !== sum) {
    report('prices', `The total is ${inr(trip.total_inr)}, but the items add up to ${inr(sum)}`);
  }
}

/** The price an item must have, and its quantity (null where the quantity is checked elsewhere). */
function expectedPrice(
  item: TripItem,
  { catalog, adults, children, travelers }: Context,
): { price: number; quantity: number | null } | null {
  switch (item.type) {
    case 'flight': {
      const flight = catalog.flights.get(item.catalog_id);
      return flight
        ? { price: flight.price_per_seat.amount * travelers, quantity: travelers }
        : null;
    }
    case 'hotel': {
      // Price per night × rooms × nights. Whether the rooms fit is the rooms rule.
      const room = item.room_id === null ? undefined : catalog.rooms.get(item.room_id);
      if (!room || item.end === null || !isDate(item.start) || !isDate(item.end)) return null;
      const nights = daysBetween(item.start, item.end);
      return { price: room.price_per_night.amount * item.quantity * nights, quantity: null };
    }
    case 'transfer': {
      const t = catalog.transfers.get(item.catalog_id);
      if (!t) return null;
      if (t.pricing === 'PER_VEHICLE') {
        const vehicles = Math.ceil(travelers / t.max_passengers);
        return { price: t.price.amount * vehicles, quantity: vehicles };
      }
      const child = t.child_price ?? t.price;
      return { price: adults * t.price.amount + children * child.amount, quantity: travelers };
    }
    case 'attraction': {
      const a = catalog.attractions.get(item.catalog_id);
      if (!a) return null;
      const child = a.child_price ?? a.price_per_person;
      return {
        price: adults * a.price_per_person.amount + children * child.amount,
        quantity: travelers,
      };
    }
  }
}

// Shared checks and small helpers. Times in the data are local clock times with no offset, and every rule compares
// times at one place, so a local date-time read as if it were UTC gives minutes that compare correctly.

function transferLegs({ trip, catalog }: Context): TransferLeg[] {
  return trip.items
    .filter((i) => i.type === 'transfer')
    .sort(byStart)
    .flatMap((item) => {
      const transfer = catalog.transfers.get(item.catalog_id);
      return transfer ? [{ item, transfer }] : [];
    });
}

/** The pickup (or the time the traveler leaves) is inside the service hours. Both ends count. */
function checkServiceHours({ report }: Context, rule: RuleId, { item, transfer }: TransferLeg) {
  const time = minutesOfDay(item.start.slice(11, 16));
  if (!inWindow(time, transfer.service_from, transfer.service_until)) {
    report(
      rule,
      `${transfer.name} runs ${transfer.service_from}–${transfer.service_until}, not at ${item.start.slice(11, 16)}`,
      item,
    );
  }
}

/** A transfer's `end`, when given, is its pickup plus its duration. */
function checkTransferEnd({ report }: Context, rule: RuleId, { item, transfer }: TransferLeg) {
  if (item.end === null) return;
  if (!isDateTime(item.end) || stamp(item.end) !== stamp(item.start) + transfer.duration_minutes) {
    report(
      rule,
      `${transfer.name} takes ${transfer.duration_minutes} minutes, so it ends at ${clockOf(stamp(item.start) + transfer.duration_minutes)}`,
      item,
    );
  }
}

const DAY = 24 * 60;
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

function byStart(a: TripItem, b: TripItem): number {
  return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);
}

/** `2027-04-09T23:50:00` to `2027-04-09T23:50`, the trip format's precision. */
function minutePrecision(local: string): string {
  return local.slice(0, 16);
}

/** `HH:MM` to minutes after midnight. `24:00` is 1440. */
function minutesOfDay(clock: string): number {
  return Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
}

/** A window in minutes. One that ends at or before it starts runs past midnight. */
function windowOf(from: string, until: string): [number, number] {
  const start = minutesOfDay(from);
  const end = minutesOfDay(until);
  return [start, end <= start ? end + DAY : end];
}

/** `time` (0–1439) is inside the window, counting the early hours covered by a window that runs past midnight. */
function inWindow(time: number, from: string, until: string): boolean {
  const [start, end] = windowOf(from, until);
  return (time >= start && time <= end) || (time + DAY >= start && time + DAY <= end);
}

/** A local date or date-time as minutes, comparable with any other at the same place. */
function stamp(local: string): number {
  const [year, month, day] = [local.slice(0, 4), local.slice(5, 7), local.slice(8, 10)].map(Number);
  const hours = local.length > 10 ? Number(local.slice(11, 13)) : 0;
  const minutes = local.length > 10 ? Number(local.slice(14, 16)) : 0;
  return Date.UTC(year, month - 1, day, hours, minutes) / 60000;
}

/** Minutes from `stamp` back to `HH:MM`, for messages. */
function clockOf(minutes: number): string {
  const inDay = ((minutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(inDay / 60)).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`;
}

function daysBetween(from: string, to: string): number {
  return (stamp(to) - stamp(from)) / DAY;
}

function addDays(date: string, days: number): string {
  return new Date((stamp(date) + days * DAY) * 60000).toISOString().slice(0, 10);
}

/** Every date from `from` up to the day before `to`: the nights of a stay. */
function nightsOf(from: string, to: string): string[] {
  return Array.from({ length: Math.max(0, daysBetween(from, to)) }, (_, i) => addDays(from, i));
}

function weekdayOf(date: string): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[new Date(stamp(date) * 60000).getUTCDay()];
}

function inr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
