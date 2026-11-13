import type { Attraction, Flight, Room, Transfer } from '../catalog/catalog.schemas';

// The price formulas in §4. All whole rupees.

/** Who travels. A child is anyone aged 0 to 17, and every child needs a seat. */
export type Party = { adults: number; children: number };

export function travelersIn(party: Party): number {
  return party.adults + party.children;
}

/** Children pay the same as adults for a seat. */
export function flightPrice(flight: Flight, party: Party): number {
  return flight.price_per_seat.amount * travelersIn(party);
}

export function hotelPrice(room: Room, rooms: number, nights: number): number {
  return room.price_per_night.amount * rooms * nights;
}

/** Vehicles for a PER_VEHICLE transfer: travelers ÷ max_passengers, rounded up. */
export function vehiclesNeeded(transfer: Transfer, party: Party): number {
  return Math.ceil(travelersIn(party) / transfer.max_passengers);
}

/** A missing `child_price` means children pay the adult price. A `child_price` of 0 means they ride free. */
export function transferPrice(transfer: Transfer, party: Party): number {
  if (transfer.pricing === 'PER_VEHICLE') {
    return transfer.price.amount * vehiclesNeeded(transfer, party);
  }
  const childPrice = transfer.child_price ?? transfer.price;
  return party.adults * transfer.price.amount + party.children * childPrice.amount;
}

/** Tickets for a PER_PERSON transfer, vehicles for a PER_VEHICLE one. */
export function transferQuantity(transfer: Transfer, party: Party): number {
  return transfer.pricing === 'PER_VEHICLE' ? vehiclesNeeded(transfer, party) : travelersIn(party);
}

/** A missing `child_price` means children pay the adult price. A `child_price` of 0 means they go free. */
export function attractionPrice(attraction: Attraction, party: Party): number {
  const childPrice = attraction.child_price ?? attraction.price_per_person;
  return party.adults * attraction.price_per_person.amount + party.children * childPrice.amount;
}
