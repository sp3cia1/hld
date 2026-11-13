import { z } from 'zod';
import { dataResponseSchema } from './common';

// Contract for POST /api/packages: the request form sends a HolidayRequest and gets a BuildResult back.
// These schemas check shape only. Limits that come from the data (cities, countries, nights, the date window)
// are checked by the API against the catalog, and come back as a VALIDATION_ERROR with one message per field.

/** A whole calendar date, `YYYY-MM-DD`. */
const localDate = z.iso.date();
/** A local date-time without a UTC offset, `YYYY-MM-DDTHH:MM`, in the time of the place it happens. */
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Use YYYY-MM-DDTHH:MM');
/** Whole rupees. The data has no paise. */
const inr = z.number().int().nonnegative();

/** The 7 fields of the request form (M1). */
export const holidayRequestSchema = z.object({
  /** Departure airport code from `GET /api/options`, for example `BLR`. */
  departureAirport: z.string().min(1, 'Choose a departure city'),
  /** Destination country code from `GET /api/options`, for example `JP`. */
  country: z.string().min(1, 'Choose a country'),
  /** The first day in the destination country: the arrival flight lands on this day. */
  startDate: localDate,
  nights: z.number().int('Nights must be a whole number').positive('Choose at least one night'),
  adults: z.number().int('Adults must be a whole number').min(1, 'At least one adult must travel'),
  /** One age per child. A child is anyone aged 0 to 17. */
  childAges: z.array(
    z
      .number()
      .int('Ages must be whole numbers')
      .min(0, 'Ages start at 0')
      .max(17, 'Anyone 18 or older travels as an adult'),
  ),
  budgetInr: z.number().int('Budget must be in whole rupees').positive('Enter a budget above 0'),
});
export type HolidayRequest = z.infer<typeof holidayRequestSchema>;

// The package, in exactly the shared trip format of DATA_DICTIONARY.md section 4. The API stores it, the screens
// show it and the export downloads it, all in this one shape, so the field names are the format's own.

export const tripItemTypeSchema = z.enum(['flight', 'hotel', 'transfer', 'attraction']);
export type TripItemType = z.infer<typeof tripItemTypeSchema>;

export const tripItemSchema = z.object({
  item_id: z.string(),
  type: tripItemTypeSchema,
  /** Name shown to the traveler. */
  name: z.string(),
  /** City of the item. For a flight: the arrival city. */
  city: z.string(),
  status: z.enum(['PLANNED', 'BOOKED']),
  /** `flight_id`, `hotel_id`, `transfer_id` or `attraction_id` from the catalog. */
  catalog_id: z.string(),
  /** Flight: departure. Hotel: check-in date. Transfer: pickup. Attraction: visit start. Local time. */
  start: z.union([localDate, localDateTime]),
  /** Flight: arrival. Hotel: check-out date. Transfer: arrival or null. Attraction: visit end. Local time. */
  end: z.union([localDate, localDateTime]).nullable(),
  /** Hotel items: the room type from rooms.json. Other items: null. */
  room_id: z.string().nullable(),
  /** Seats, rooms, vehicles or tickets. */
  quantity: z.number().int().positive(),
  /** Total price of this item. */
  price_inr: inr,
  /** Set at confirm: the reservation number as a string. */
  booking: z.object({ reference: z.string() }).nullable(),
  /** Always empty in Problem 1. */
  sources: z.array(z.never()),
  warnings: z.array(z.string()),
});
export type TripItem = z.infer<typeof tripItemSchema>;

export const tripSchema = z.object({
  /** The package id. */
  trip_id: z.string(),
  traveler: z.object({
    /** The form has no name field, so this is null. */
    name: z.string().nullable(),
    home_airport: z.string(),
    adults: z.number().int(),
    children: z.number().int(),
    child_ages: z.array(z.number().int()),
  }),
  /** The holiday start date. */
  start_date: localDate,
  /** The return day. */
  end_date: localDate,
  /** Destination country name, for example `Japan`. */
  country: z.string(),
  budget_inr: inr,
  /** Sum of `price_inr` over all items. */
  total_inr: inr,
  /** PLANNED until confirm, then BOOKED. */
  status: z.enum(['PLANNED', 'BOOKED']),
  /** Items in time order. */
  items: z.array(tripItemSchema),
});
export type Trip = z.infer<typeof tripSchema>;

/** Total against budget (M5). `leftInr` is negative when the package is over budget. */
export const budgetSummarySchema = z.object({
  budgetInr: inr,
  totalInr: inr,
  leftInr: z.number().int(),
});
export type BudgetSummary = z.infer<typeof budgetSummarySchema>;

/** Why no package is possible (M2). `message` is written for the traveler. */
export const noPackageReasonSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type NoPackageReason = z.infer<typeof noPackageReasonSchema>;

/**
 * What POST /api/packages returns inside `{ data }`.
 * - OK (201): a package within budget, saved.
 * - OVER_BUDGET (201): no package fits the budget, so this is the cheapest one, saved and labelled (M8).
 * - NO_PACKAGE (200): no package is possible for this request. Nothing is saved.
 * A value that is not valid is a 400 VALIDATION_ERROR instead (see `apiErrorSchema` in common.ts).
 */
export const buildResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('OK'),
    packageId: z.string(),
    trip: tripSchema,
    budget: budgetSummarySchema,
  }),
  z.object({
    status: z.literal('OVER_BUDGET'),
    packageId: z.string(),
    trip: tripSchema,
    budget: budgetSummarySchema,
  }),
  z.object({
    status: z.literal('NO_PACKAGE'),
    reason: noPackageReasonSchema,
  }),
]);
export type BuildResult = z.infer<typeof buildResultSchema>;

export const buildResponseSchema = dataResponseSchema(buildResultSchema);
export type BuildResponse = z.infer<typeof buildResponseSchema>;
