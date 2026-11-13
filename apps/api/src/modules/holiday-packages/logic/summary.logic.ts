import type { PackageSummary, Trip } from '@bh/shared/holiday-package';
import type { Catalog } from '../../catalog/catalog.logic';
import { daysBetween } from './time.logic';

/**
 * What the package labels compare (G4), read from the trip itself so it stays right after a change: the travel time
 * (both flights plus every move between cities; airport transfers and city taxis don't count) and the hotel stars
 * averaged over the nights, to 2 decimals.
 */
export function summaryOf(trip: Omit<Trip, 'trip_id'>, catalog: Catalog): PackageSummary {
  let travelMinutes = 0;
  let starNights = 0;
  let nights = 0;
  for (const item of trip.items) {
    if (item.type === 'flight') {
      travelMinutes += catalog.flights.get(item.catalog_id)!.duration_minutes;
    } else if (item.type === 'transfer') {
      const transfer = catalog.transfers.get(item.catalog_id)!;
      if (transfer.from_city !== undefined) travelMinutes += transfer.duration_minutes;
    } else if (item.type === 'hotel') {
      const stay = daysBetween(item.start, item.end ?? item.start);
      nights += stay;
      starNights += catalog.hotels.get(item.catalog_id)!.stars * stay;
    }
  }
  const averageStars = nights === 0 ? 0 : Math.round((starNights / nights) * 100) / 100;
  return { travelMinutes, averageStars };
}
