import type { Room } from '../../catalog/catalog.schemas';
import { travelersIn, type Party } from './pricing.logic';

/**
 * The fewest rooms of this type that fit the party, or null if no number does. `k` rooms fit when
 * adults ≤ k × max_adults, travelers ≤ k × (max_adults + max_children), and adults ≥ k (§4).
 * Within one room type the smallest `k` is always best: the price and the rooms needed both grow with `k`.
 */
export function roomsNeeded(room: Room, party: Party): number | null {
  const rooms = Math.max(
    Math.ceil(party.adults / room.max_adults),
    Math.ceil(travelersIn(party) / (room.max_adults + room.max_children)),
  );
  return rooms <= party.adults ? rooms : null;
}
