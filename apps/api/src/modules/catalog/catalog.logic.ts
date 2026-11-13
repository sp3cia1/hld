import type {
  Airport,
  Attraction,
  Availability,
  Destinations,
  Flight,
  Hotel,
  Room,
  Transfer,
} from './catalog.schemas';

/** The 8 catalog files after their records passed the schemas. */
export type CatalogFiles = {
  destinations: Destinations;
  airports: Airport[];
  flights: Flight[];
  hotels: Hotel[];
  rooms: Room[];
  availability: Availability[];
  transfers: Transfer[];
  attractions: Attraction[];
};

/** The catalog, indexed by the questions the builder asks. Built once at startup, never changed. */
export type Catalog = {
  destinations: Destinations;
  airports: Map<string, Airport>;
  /** City name -> airports whose `serves_cities` includes it. */
  airportsServingCity: Map<string, Airport[]>;
  flights: Map<string, Flight>;
  /** `from|to|date of arrival_local` -> flights. */
  flightsByArrival: Map<string, Flight[]>;
  /** `from|to|date of departure_local` -> flights. */
  flightsByDeparture: Map<string, Flight[]>;
  hotels: Map<string, Hotel>;
  hotelsByCity: Map<string, Hotel[]>;
  rooms: Map<string, Room>;
  roomsByHotel: Map<string, Room[]>;
  /** `room_id|night` -> rooms left. A missing key means no rooms that night. */
  roomsLeft: Map<string, number>;
  transfers: Map<string, Transfer>;
  /** `airport|city` -> airport transfers. Filter by the hotel's area (`null` serves every area). */
  airportTransfers: Map<string, Transfer[]>;
  /** `from_city|to_city` -> transfers between cities, from the links in destinations.json. */
  intercityTransfers: Map<string, Transfer[]>;
  /** City name -> taxis and buses inside the city (to and from stations). */
  cityTransfers: Map<string, Transfer[]>;
  attractions: Map<string, Attraction>;
  attractionsByCity: Map<string, Attraction[]>;
};

/** Joins the parts of an index key. */
export function key(...parts: string[]): string {
  return parts.join('|');
}

/** Builds the indexes and checks that every reference between files points at a record that exists. */
export function buildCatalog(files: CatalogFiles): Catalog {
  const problems: string[] = [];

  const airports = byId(files.airports, (a) => a.code, 'airports.json', problems);
  const flights = byId(files.flights, (f) => f.flight_id, 'flights.json', problems);
  const hotels = byId(files.hotels, (h) => h.hotel_id, 'hotels.json', problems);
  const rooms = byId(files.rooms, (r) => r.room_id, 'rooms.json', problems);
  const transfers = byId(files.transfers, (t) => t.transfer_id, 'transfers.json', problems);
  const attractions = byId(files.attractions, (a) => a.attraction_id, 'attractions.json', problems);

  const destinationCities = new Set(
    files.destinations.countries.flatMap((c) => c.cities.map((city) => city.name)),
  );

  for (const d of files.destinations.departure_cities) {
    if (!airports.has(d.airport)) problems.push(`destinations.json: unknown airport ${d.airport}`);
  }
  for (const country of files.destinations.countries) {
    for (const city of country.cities) {
      for (const code of city.airports) {
        if (!airports.has(code))
          problems.push(`destinations.json: ${city.name} lists unknown airport ${code}`);
      }
    }
    for (const link of country.links) {
      for (const id of link.transfer_ids) {
        if (!transfers.has(id))
          problems.push(
            `destinations.json: link ${link.from_city} to ${link.to_city} lists unknown transfer ${id}`,
          );
      }
    }
  }
  for (const a of files.airports) {
    for (const city of a.serves_cities ?? []) {
      if (!destinationCities.has(city))
        problems.push(`airports.json: ${a.code} serves unknown city ${city}`);
    }
  }
  for (const f of files.flights) {
    if (!airports.has(f.from))
      problems.push(`flights.json: ${f.flight_id} leaves from unknown airport ${f.from}`);
    if (!airports.has(f.to))
      problems.push(`flights.json: ${f.flight_id} lands at unknown airport ${f.to}`);
  }
  for (const r of files.rooms) {
    if (!hotels.has(r.hotel_id))
      problems.push(`rooms.json: ${r.room_id} belongs to unknown hotel ${r.hotel_id}`);
  }
  for (const a of files.availability) {
    if (!rooms.has(a.room_id))
      problems.push(`availability.json: unknown room ${a.room_id} on ${a.date}`);
  }
  for (const t of files.transfers) {
    if (t.airport !== null && !airports.has(t.airport)) {
      problems.push(`transfers.json: ${t.transfer_id} uses unknown airport ${t.airport}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`The catalog does not hold together:\n  ${problems.slice(0, 20).join('\n  ')}`);
  }

  const airportsServingCity = new Map<string, Airport[]>();
  for (const a of files.airports) {
    for (const city of a.serves_cities ?? []) push(airportsServingCity, city, a);
  }

  const flightsByArrival = new Map<string, Flight[]>();
  const flightsByDeparture = new Map<string, Flight[]>();
  for (const f of files.flights) {
    push(flightsByArrival, key(f.from, f.to, f.arrival_local.slice(0, 10)), f);
    push(flightsByDeparture, key(f.from, f.to, f.departure_local.slice(0, 10)), f);
  }

  const hotelsByCity = groupBy(files.hotels, (h) => h.city);
  const roomsByHotel = groupBy(files.rooms, (r) => r.hotel_id);
  const roomsLeft = new Map(files.availability.map((a) => [key(a.room_id, a.date), a.rooms_left]));

  const airportTransfers = new Map<string, Transfer[]>();
  const cityTransfers = new Map<string, Transfer[]>();
  for (const t of files.transfers) {
    if (t.airport !== null && t.city !== null) push(airportTransfers, key(t.airport, t.city), t);
    if ((t.type === 'CITY_TAXI' || t.type === 'CITY_BUS') && t.city !== null)
      push(cityTransfers, t.city, t);
  }

  const intercityTransfers = new Map<string, Transfer[]>();
  for (const country of files.destinations.countries) {
    for (const link of country.links) {
      intercityTransfers.set(
        key(link.from_city, link.to_city),
        link.transfer_ids.map((id) => transfers.get(id)!),
      );
    }
  }

  return {
    destinations: files.destinations,
    airports,
    airportsServingCity,
    flights,
    flightsByArrival,
    flightsByDeparture,
    hotels,
    hotelsByCity,
    rooms,
    roomsByHotel,
    roomsLeft,
    transfers,
    airportTransfers,
    intercityTransfers,
    cityTransfers,
    attractions,
    attractionsByCity: groupBy(files.attractions, (a) => a.city),
  };
}

function byId<T>(records: T[], id: (record: T) => string, file: string, problems: string[]) {
  const map = new Map<string, T>();
  for (const record of records) {
    const value = id(record);
    if (map.has(value)) problems.push(`${file}: duplicate id ${value}`);
    map.set(value, record);
  }
  return map;
}

function groupBy<T>(records: T[], groupKey: (record: T) => string) {
  const map = new Map<string, T[]>();
  for (const record of records) push(map, groupKey(record), record);
  return map;
}

function push<K, V>(map: Map<K, V[]>, mapKey: K, value: V) {
  const list = map.get(mapKey);
  if (list) list.push(value);
  else map.set(mapKey, [value]);
}
