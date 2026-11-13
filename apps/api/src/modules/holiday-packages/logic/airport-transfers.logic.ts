import { key, type Catalog } from '../../catalog/catalog.logic';
import type { Flight, Hotel, Transfer } from '../../catalog/catalog.schemas';
import { transferPrice, type Party } from './pricing.logic';
import { earliestInWindow, latestInWindow, minutesOf } from './time.logic';
import { MIN_MINUTES_AFTER_LANDING, MIN_MINUTES_BEFORE_DEPARTURE } from './travel-rules';

// The airport transfer at each end of a trip. The builder picks one for every flight and hotel it tries. A change picks
// again with the same functions when the traveler swaps a flight or a hotel (decision 0011: the app picks how and when).

/**
 * A transfer and when it runs, in minutes after midnight of the day: the pickup at the airport when arriving, the time
 * the traveler leaves the hotel when leaving. Past 1440 is after midnight. `price` is for the whole party.
 */
export type TransferPick = { transfer: Transfer; at: number; price: number };

/**
 * The cheapest transfer from the flight's airport to the hotel, picked up at the earliest time at or after landing +
 * 60 minutes inside its service hours. On equal price, the one that reaches the hotel sooner, then catalog order.
 * Null when none runs then.
 */
export function cheapestTransferFromAirport(
  flight: Flight,
  hotel: Hotel,
  catalog: Catalog,
  party: Party,
): TransferPick | null {
  const earliest = minutesOf(flight.arrival_local.slice(11)) + MIN_MINUTES_AFTER_LANDING;
  let best: TransferPick | null = null;
  for (const transfer of transfersFor(flight.to, hotel, catalog)) {
    const at = earliestInWindow(earliest, transfer.service_from, transfer.service_until);
    if (at === null) continue;
    const price = transferPrice(transfer, party);
    const reachesHotel = at + transfer.duration_minutes;
    if (
      !best ||
      price < best.price ||
      (price === best.price && reachesHotel < best.at + best.transfer.duration_minutes)
    ) {
      best = { transfer, at, price };
    }
  }
  return best;
}

/**
 * The cheapest transfer from the hotel to the flight's airport, leaving the hotel at the latest time that still
 * reaches the airport 180 minutes before departure, inside its service hours, on the day of the flight. On equal
 * price, the one that leaves the hotel later, then catalog order. Null when none can.
 */
export function cheapestTransferToAirport(
  flight: Flight,
  hotel: Hotel,
  catalog: Catalog,
  party: Party,
): TransferPick | null {
  const departs = minutesOf(flight.departure_local.slice(11));
  let best: TransferPick | null = null;
  for (const transfer of transfersFor(flight.from, hotel, catalog)) {
    const latest = departs - MIN_MINUTES_BEFORE_DEPARTURE - transfer.duration_minutes;
    const at = latestInWindow(latest, transfer.service_from, transfer.service_until);
    if (at === null) continue;
    const price = transferPrice(transfer, party);
    if (!best || price < best.price || (price === best.price && at > best.at)) {
      best = { transfer, at, price };
    }
  }
  return best;
}

/** Airport transfers between `airport` and the hotel's area. `area: null` serves every area of the city. */
function transfersFor(airport: string, hotel: Hotel, catalog: Catalog): Transfer[] {
  return (catalog.airportTransfers.get(key(airport, hotel.city)) ?? []).filter(
    (t) => t.area === null || t.area === hotel.area,
  );
}
