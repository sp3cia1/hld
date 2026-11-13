import { z } from 'zod';
import { dataResponseSchema } from './common';

// Contract for the rule check: which travel rules (§4 of the statement) a package passes. The API's validator
// fills it; the package page's rules panel shows it. Titles carry no numbers from the data (nights, dates), because
// those come from destinations.json.

/** Every rule a package is checked against, in the order the rules panel lists them. */
export const RULE_IDS = [
  'trip-dates',
  'cities',
  'flights',
  'seats',
  'airport-transfers',
  'city-transfers',
  'hotels',
  'rooms',
  'attractions',
  'attraction-days',
  'prices',
  'format',
] as const;

export const ruleIdSchema = z.enum(RULE_IDS);
export type RuleId = z.infer<typeof ruleIdSchema>;

/** What each rule means, in the traveler's words. */
export const RULE_TITLES: Record<RuleId, string> = {
  'trip-dates': 'The number of nights and the dates are allowed',
  cities: 'Every city is in the country, appears once and has enough nights in a row',
  flights:
    'The flights land on the first day and leave on the last day, at airports serving those cities',
  seats: 'Both flights have a seat for every traveler',
  'airport-transfers':
    'The airport transfers reach the hotel, wait after landing, leave time before departure and run at those hours',
  'city-transfers': 'Each change of city has one transfer between the cities, at a time it runs',
  hotels: 'One hotel and one room type per city, for every night of the trip',
  rooms: 'The rooms fit everyone and are free on every night',
  attractions: 'Each visit is in the right city, while it is open, with no overlaps or repeats',
  'attraction-days': 'Every full day has a visit, and the last day has none',
  prices: 'Every price follows the price rules, and the total adds up',
  format: 'The package is complete in the shared trip format',
};

/** One broken rule. `itemId` names the item at fault, or is null when the rule is about the whole package. */
export const tripProblemSchema = z.object({
  rule: ruleIdSchema,
  itemId: z.string().nullable(),
  message: z.string(),
});
export type TripProblem = z.infer<typeof tripProblemSchema>;

/** Every rule with whether it passes, plus the problems behind any that fail. */
export const tripCheckSchema = z.object({
  rules: z.array(z.object({ id: ruleIdSchema, title: z.string(), passed: z.boolean() })),
  problems: z.array(tripProblemSchema),
});
export type TripCheck = z.infer<typeof tripCheckSchema>;

/** What GET /api/packages/:id/check returns: the rule check of the saved package, inside `{ data }`. */
export const tripCheckResponseSchema = dataResponseSchema(tripCheckSchema);
export type TripCheckResponse = z.infer<typeof tripCheckResponseSchema>;
