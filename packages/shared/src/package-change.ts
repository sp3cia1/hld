import { z } from 'zod';
import { dataResponseSchema } from './common';
import { savedPackageSchema } from './holiday-package';
import { tripProblemSchema } from './trip-check';

// Contract for changing a saved package (M6): the choices for one part, and the change itself.
// GET  /api/packages/:id/choices/hotel?city=…    -> { data: HotelChoices }
// GET  /api/packages/:id/choices/flight?direction=… -> { data: FlightChoices }
// POST /api/packages/:id/changes  (a ChangeRequest) -> { data: ChangeResult }

/** Whole rupees. The data has no paise. */
const inr = z.number().int().nonnegative();
/** A local date-time without a UTC offset, `YYYY-MM-DDTHH:MM`, in the time of the place it happens. */
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Use YYYY-MM-DDTHH:MM');

export const flightDirectionSchema = z.enum(['arrival', 'return']);
export type FlightDirection = z.infer<typeof flightDirectionSchema>;

/** Stay at another hotel or room type in a city of the plan, for the same nights. */
export const hotelChangeSchema = z.object({
  type: z.literal('hotel'),
  city: z.string().min(1),
  hotelId: z.string().min(1),
  roomId: z.string().min(1),
});
export type HotelChange = z.infer<typeof hotelChangeSchema>;

/** Take another arrival flight or return flight. */
export const flightChangeSchema = z.object({
  type: z.literal('flight'),
  direction: flightDirectionSchema,
  flightId: z.string().min(1),
});
export type FlightChange = z.infer<typeof flightChangeSchema>;

/** One change, named by `type`. A new kind of change is one more schema in this list. */
export const changeRequestSchema = z.discriminatedUnion('type', [
  hotelChangeSchema,
  flightChangeSchema,
]);
export type ChangeRequest = z.infer<typeof changeRequestSchema>;

/**
 * What a change returns, inside `{ data }`. Both are a 200: a refusal is a valid answer to a valid request.
 * - APPLIED: the package was checked again and saved. `package` is what GET /api/packages/:id now returns.
 * - REFUSED: the change would break these rules. Nothing was saved.
 */
export const changeResultSchema = z.discriminatedUnion('result', [
  z.object({ result: z.literal('APPLIED'), package: savedPackageSchema }),
  z.object({ result: z.literal('REFUSED'), problems: z.array(tripProblemSchema).min(1) }),
]);
export type ChangeResult = z.infer<typeof changeResultSchema>;

export const changeResponseSchema = dataResponseSchema(changeResultSchema);
export type ChangeResponse = z.infer<typeof changeResponseSchema>;

// A choice comes with a preview from a dry run of the same change POST makes, so the two never disagree.
// READY: it would be applied, at this new total. BLOCKED: it would be refused, for this reason. A BLOCKED choice can
// still be picked; the change then comes back REFUSED with the same reason.

const choiceFields = {
  /** The price of the item itself, for the whole party. */
  priceInr: inr,
  /** The choice the package has now. */
  current: z.boolean(),
};
const ready = {
  status: z.literal('READY'),
  newTotalInr: inr,
  /** New total minus the current total. Negative when the change saves money. */
  differenceInr: z.number().int(),
  reason: z.null(),
};
const blocked = {
  status: z.literal('BLOCKED'),
  newTotalInr: z.null(),
  differenceInr: z.null(),
  /** The first rule the change would break, in the traveler's words. */
  reason: z.string(),
};

const hotelChoiceFields = {
  ...choiceFields,
  hotelId: z.string(),
  roomId: z.string(),
  hotelName: z.string(),
  roomName: z.string(),
  area: z.string(),
  stars: z.number().int(),
  /** The fewest rooms of this type that fit the party. */
  rooms: z.number().int().positive(),
  nights: z.number().int().positive(),
};
export const hotelChoiceSchema = z.discriminatedUnion('status', [
  z.object({ ...hotelChoiceFields, ...ready }),
  z.object({ ...hotelChoiceFields, ...blocked }),
]);
export type HotelChoice = z.infer<typeof hotelChoiceSchema>;

const flightChoiceFields = {
  ...choiceFields,
  flightId: z.string(),
  flightNumber: z.string(),
  /** Airport codes. */
  from: z.string(),
  to: z.string(),
  /** Local time at `from`. */
  departs: localDateTime,
  /** Local time at `to`. */
  arrives: localDateTime,
  stops: z.number().int().nonnegative(),
};
export const flightChoiceSchema = z.discriminatedUnion('status', [
  z.object({ ...flightChoiceFields, ...ready }),
  z.object({ ...flightChoiceFields, ...blocked }),
]);
export type FlightChoice = z.infer<typeof flightChoiceSchema>;

/**
 * The choices, current first, then READY from the smallest difference, then BLOCKED. `hidden` counts the choices that
 * can never work for this party and dates (room types that can't sleep everyone, flights without a seat for each
 * traveler), which are left out.
 */
export const hotelChoicesSchema = z.object({
  choices: z.array(hotelChoiceSchema),
  hidden: z.number().int().nonnegative(),
});
export type HotelChoices = z.infer<typeof hotelChoicesSchema>;

export const flightChoicesSchema = z.object({
  choices: z.array(flightChoiceSchema),
  hidden: z.number().int().nonnegative(),
});
export type FlightChoices = z.infer<typeof flightChoicesSchema>;

export const hotelChoicesResponseSchema = dataResponseSchema(hotelChoicesSchema);
export const flightChoicesResponseSchema = dataResponseSchema(flightChoicesSchema);

export const hotelChoicesQuerySchema = z.object({ city: z.string().min(1) });
export const flightChoicesQuerySchema = z.object({ direction: flightDirectionSchema });
