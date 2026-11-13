import type { Trip } from '@bh/shared/holiday-package';
import { daysBetween } from './time.logic';

/** One city of a plan and the nights spent there. */
export type CityStop = { city: string; nights: number };
/** The cities of a trip in travel order. */
export type CityPlan = CityStop[];

/**
 * Every city plan for a trip of `nights` nights (§4): each order of different cities, each linked to the next by a
 * train, bus or taxi, with at least `minNightsPerCity` nights in a row in each, adding up to the trip. Nothing caps the
 * number of cities but these rules. Plans come out in a fixed order, the cities' order in the data, so results repeat.
 */
export function cityPlans(
  cities: string[],
  nights: number,
  minNightsPerCity: number,
  linked: (from: string, to: string) => boolean,
): CityPlan[] {
  const plans: CityPlan[] = [];
  const extend = (plan: CityPlan, nightsLeft: number) => {
    if (nightsLeft === 0) {
      plans.push(plan);
      return;
    }
    const previous = plan.at(-1);
    for (const city of cities) {
      if (plan.some((stop) => stop.city === city)) continue;
      if (previous && !linked(previous.city, city)) continue;
      for (let stay = minNightsPerCity; stay <= nightsLeft; stay++) {
        const rest = nightsLeft - stay;
        // The nights left must still make a whole city's stay, or none.
        if (rest > 0 && rest < minNightsPerCity) continue;
        extend([...plan, { city, nights: stay }], rest);
      }
    }
  };
  extend([], nights);
  return plans;
}

/** True when two plans visit the same cities, in the same order, for the same nights. */
export function samePlan(a: CityPlan, b: CityPlan): boolean {
  return (
    a.length === b.length &&
    a.every((stop, i) => stop.city === b[i]!.city && stop.nights === b[i]!.nights)
  );
}

/** The city plan of a trip, read from its hotels in travel order. */
export function planOf(trip: Omit<Trip, 'trip_id'>): CityPlan {
  return trip.items
    .filter((item) => item.type === 'hotel')
    .map((item) => ({ city: item.city, nights: daysBetween(item.start, item.end ?? item.start) }));
}
