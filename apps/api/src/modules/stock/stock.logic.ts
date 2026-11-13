import type { Trip } from '@bh/shared/holiday-package';
import { key, type Catalog } from '../catalog/catalog.logic';
import type { Flight } from '../catalog/catalog.schemas';
import { addDays, daysBetween, formatDate } from '../holiday-packages/logic/time.logic';

// S2: a confirmed reservation uses up seats and rooms. The catalog's numbers never change (§7: the data files stay as
// they are). The app keeps what bookings left in its own tables (FlightStock, RoomStock), and these pure functions
// connect the two: what a package needs, and the catalog as bookings have left it.

/** The seats on one flight a booking needs, and how many the catalog starts with. */
export type SeatNeed = { flightId: string; seats: number; inCatalog: number };
/** The rooms of one type on one night a booking needs, and how many the catalog starts with. */
export type RoomNeed = { roomId: string; night: string; rooms: number; inCatalog: number };
export type StockNeeds = { seats: SeatNeed[]; rooms: RoomNeed[] };
/** A need that wasn't there any more when the booking tried to take it. */
export type Shortage = { kind: 'seats'; need: SeatNeed } | { kind: 'rooms'; need: RoomNeed };

/**
 * What a package uses: its seats on each flight, and its rooms on every night of every stay. Sorted, so two bookings
 * always take the same rows in the same order and can never wait on each other in a circle.
 */
export function stockNeeds(trip: Trip, catalog: Catalog): StockNeeds {
  const seats = trip.items
    .filter((item) => item.type === 'flight')
    .map((item) => ({
      flightId: item.catalog_id,
      seats: item.quantity,
      inCatalog: catalog.flights.get(item.catalog_id)?.seats_left ?? 0,
    }));
  const rooms = trip.items.flatMap((item) => {
    if (item.type !== 'hotel' || item.room_id === null || item.end === null) return [];
    const roomId = item.room_id;
    return Array.from({ length: daysBetween(item.start, item.end) }, (_, i) => {
      const night = addDays(item.start, i);
      const inCatalog = catalog.roomsLeft.get(key(roomId, night)) ?? 0;
      return { roomId, night, rooms: item.quantity, inCatalog };
    });
  });
  return {
    seats: seats.sort((a, b) => a.flightId.localeCompare(b.flightId)),
    rooms: rooms.sort((a, b) => key(a.roomId, a.night).localeCompare(key(b.roomId, b.night))),
  };
}

/**
 * The catalog as bookings have left it, for the builder: seats and rooms already booked are gone, so a new package
 * only uses what is still free. `seatsLeft` and `roomsLeft` hold only what bookings touched (room keys from `key()`);
 * everything else keeps the catalog's number. With nothing booked, the catalog itself comes back.
 */
export function withBookedStock(
  catalog: Catalog,
  seatsLeft: Map<string, number>,
  roomsLeft: Map<string, number>,
): Catalog {
  if (seatsLeft.size === 0 && roomsLeft.size === 0) return catalog;

  const flights = new Map<string, Flight>();
  for (const [id, flight] of catalog.flights) {
    const left = seatsLeft.get(id);
    flights.set(id, left === undefined ? flight : { ...flight, seats_left: left });
  }
  // The flight indexes hold the flight records themselves, so they point at the updated ones too.
  const updated = (index: Map<string, Flight[]>) =>
    new Map(
      [...index].map(([indexKey, list]) => [
        indexKey,
        list.map((flight) => flights.get(flight.flight_id) ?? flight),
      ]),
    );

  return {
    ...catalog,
    flights,
    flightsByArrival: updated(catalog.flightsByArrival),
    flightsByDeparture: updated(catalog.flightsByDeparture),
    roomsLeft: new Map([...catalog.roomsLeft, ...roomsLeft]),
  };
}

/** A shortage in the traveler's words: "AV 520 doesn't have 3 seats left". */
export function shortageMessage(shortage: Shortage, catalog: Catalog): string {
  if (shortage.kind === 'seats') {
    const { flightId, seats } = shortage.need;
    const flight = catalog.flights.get(flightId)?.flight_number ?? flightId;
    return `${flight} doesn't have ${count(seats, 'seat')} left`;
  }
  const { roomId, night, rooms } = shortage.need;
  const room = catalog.rooms.get(roomId);
  const hotel = room ? catalog.hotels.get(room.hotel_id)?.name : undefined;
  const where = hotel && room ? `${hotel}, ${room.name}` : roomId;
  return `${where} doesn't have ${count(rooms, 'room')} left on the night of ${formatDate(night)}`;
}

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
