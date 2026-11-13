import type { FreeTime, Trip } from '@bh/shared/holiday-package';
import type { Catalog } from '../../catalog/catalog.logic';
import type { Transfer } from '../../catalog/catalog.schemas';
import { earliestVisit } from './attractions.logic';
import { attractionPrice, transferPrice, type Party } from './pricing.logic';
import { earliestInWindow, localDateTime, minutesOf } from './time.logic';

// The first package plans no visits on the arrival day or on a day the traveler moves city: §4 makes them optional,
// and after a long flight or a move a free afternoon is the calm default. Instead, the traveler sees what still fits
// and chooses. docs/SOLUTION.md has the decision.

/**
 * A day the traveler reaches a new hotel, and when (minutes after midnight). On a change day by train or bus, the taxi
 * from the station that gets them there: a visit that day adds it to the package. Null otherwise.
 */
export type HotelArrival = {
  day: string;
  city: string;
  at: number;
  stationTaxi: { transfer: Transfer; at: number; price: number } | null;
};

/**
 * The attractions that still fit on the arrival day and on each city-change day, after the traveler reaches the
 * hotel. A day that already has a visit was the traveler's choice and gets no list. Cheapest first; on equal price,
 * the one with the most room left in the day; then catalog order.
 */
export function freeTimeIn(trip: Omit<Trip, 'trip_id'>, catalog: Catalog): FreeTime[] {
  const party: Party = { adults: trip.traveler.adults, children: trip.traveler.children };
  const visits = trip.items.filter((item) => item.type === 'attraction');
  const inPackage = new Set(visits.map((visit) => visit.catalog_id));
  const daysWithVisits = new Set(visits.map((visit) => visit.start.slice(0, 10)));

  return arrivalsIn(trip, catalog, party)
    .filter((arrival) => !daysWithVisits.has(arrival.day))
    .flatMap((arrival): FreeTime[] => {
      const fits = (catalog.attractionsByCity.get(arrival.city) ?? []).flatMap((attraction) => {
        if (inPackage.has(attraction.attraction_id)) return [];
        const visit = earliestVisit(attraction, arrival.day, arrival.at);
        if (!visit) return [];
        const room = visit.closes - visit.start - attraction.visit_minutes;
        return [{ attraction, ...visit, room, price: attractionPrice(attraction, party) }];
      });
      if (fits.length === 0) return [];
      // The sort is stable, so the catalog's order breaks the last ties.
      fits.sort((a, b) => a.price - b.price || b.room - a.room);
      return [
        {
          date: arrival.day,
          city: arrival.city,
          freeFrom: localDateTime(arrival.day, arrival.at),
          stationTaxiInr: arrival.stationTaxi?.price ?? null,
          attractions: fits.map((fit) => ({
            attractionId: fit.attraction.attraction_id,
            name: fit.attraction.name,
            earliestStart: localDateTime(arrival.day, fit.start),
            endBy: localDateTime(arrival.day, fit.closes),
            visitMinutes: fit.attraction.visit_minutes,
            priceInr: fit.price,
          })),
        },
      ];
    });
}

/**
 * When the traveler reaches each new hotel.
 * - Arrival day: the airport transfer's pickup plus its duration. A pickup after midnight leaves no free time that day.
 * - City-change day: the train or bus arrival plus the city's taxi from the station, which a visit would add to the
 *   package with its price. A door-to-door taxi arrives at the hotel itself.
 */
export function arrivalsIn(
  trip: Omit<Trip, 'trip_id'>,
  catalog: Catalog,
  party: Party,
): HotelArrival[] {
  const arrivals: HotelArrival[] = [];
  for (const item of trip.items) {
    if (item.type !== 'transfer') continue;
    const transfer = catalog.transfers.get(item.catalog_id)!;
    const day = item.start.slice(0, 10);
    const reached = minutesOf(item.start.slice(11)) + transfer.duration_minutes;

    if (transfer.airport !== null) {
      if (day === trip.start_date)
        arrivals.push({ day, city: item.city, at: reached, stationTaxi: null });
      continue;
    }
    const city = transfer.to_city;
    if (city === undefined) continue;
    if (transfer.door_to_door) {
      arrivals.push({ day, city, at: reached, stationTaxi: null });
      continue;
    }
    // Without a taxi from the station, running when the train gets in, there is no knowing when they reach the hotel.
    const taxi = catalog.cityTransfers.get(city)?.find((t) => t.type === 'CITY_TAXI');
    if (!taxi) continue;
    const pickup = earliestInWindow(reached, taxi.service_from, taxi.service_until);
    if (pickup === null) continue;
    arrivals.push({
      day,
      city,
      at: pickup + taxi.duration_minutes,
      stationTaxi: { transfer: taxi, at: pickup, price: transferPrice(taxi, party) },
    });
  }
  return arrivals;
}
