import type { TripItem } from '@bh/shared/holiday-package';
import type { Attraction, Flight, Hotel, Room, Transfer } from '../../catalog/catalog.schemas';
import {
  attractionPrice,
  flightPrice,
  hotelPrice,
  transferPrice,
  transferQuantity,
  travelersIn,
  type Party,
} from './pricing.logic';
import { daysBetween, localDateTime } from './time.logic';

// The items of a package in the shared trip format. The builder writes a new package with them, and a change writes
// the item it swaps in, so a changed package looks exactly like a built one. Times are local, without seconds.

/** An item before it has its `item_id`, which belongs to its place in the package. */
export type NewItem = Omit<TripItem, 'item_id'>;

/** A flight's `city` is where it lands. Times keep the flight's own local times, without seconds. */
export function flightItem(flight: Flight, city: string, party: Party): NewItem {
  return item({
    type: 'flight',
    name: `${flight.flight_number} ${flight.from} to ${flight.to}`,
    city,
    catalog_id: flight.flight_id,
    start: flight.departure_local.slice(0, 16),
    end: flight.arrival_local.slice(0, 16),
    room_id: null,
    quantity: travelersIn(party),
    price_inr: flightPrice(flight, party),
  });
}

/** `at` is minutes after midnight of `date`, the pickup. Past 1440 falls on the next day. */
export function transferItem(
  transfer: Transfer,
  city: string,
  date: string,
  at: number,
  party: Party,
): NewItem {
  return item({
    type: 'transfer',
    name: transfer.name,
    city,
    catalog_id: transfer.transfer_id,
    start: localDateTime(date, at),
    end: localDateTime(date, at + transfer.duration_minutes),
    room_id: null,
    quantity: transferQuantity(transfer, party),
    price_inr: transferPrice(transfer, party),
  });
}

/** `checkIn` is the first night, `checkOut` the day after the last one. */
export function hotelItem(
  hotel: Hotel,
  room: Room,
  rooms: number,
  checkIn: string,
  checkOut: string,
): NewItem {
  return item({
    type: 'hotel',
    name: `${hotel.name}, ${room.name}`,
    city: hotel.city,
    catalog_id: hotel.hotel_id,
    start: checkIn,
    end: checkOut,
    room_id: room.room_id,
    quantity: rooms,
    price_inr: hotelPrice(room, rooms, daysBetween(checkIn, checkOut)),
  });
}

/** `start` is minutes after midnight of `day`. */
export function attractionItem(
  attraction: Attraction,
  day: string,
  start: number,
  party: Party,
): NewItem {
  return item({
    type: 'attraction',
    name: attraction.name,
    city: attraction.city,
    catalog_id: attraction.attraction_id,
    start: localDateTime(day, start),
    end: localDateTime(day, start + attraction.visit_minutes),
    room_id: null,
    quantity: travelersIn(party),
    price_inr: attractionPrice(attraction, party),
  });
}

function item(
  fields: Pick<
    NewItem,
    'type' | 'name' | 'city' | 'catalog_id' | 'start' | 'end' | 'room_id' | 'quantity' | 'price_inr'
  >,
): NewItem {
  return { ...fields, status: 'PLANNED', booking: null, sources: [], warnings: [] };
}
