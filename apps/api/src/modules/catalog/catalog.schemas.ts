import { z } from 'zod';

// One schema per catalog file, written from DATA_DICTIONARY.md. The loader checks every record against these at
// startup, so the builder never sees a value it does not expect.

/** `HH:MM`. `24:00` is midnight at the end of the day. */
const clock = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'Expected a clock time HH:MM (24:00 allowed)');
/** `YYYY-MM-DD`. */
const date = z.iso.date();
/** `YYYY-MM-DDTHH:MM:SS`, local time without an offset. */
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, 'Expected a local date-time YYYY-MM-DDTHH:MM:SS');
/** Whole rupees. */
const money = z.object({ amount: z.number().int().nonnegative(), currency: z.literal('INR') });
const count = z.number().int().nonnegative();
const weekday = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);

export const destinationsSchema = z.object({
  departure_cities: z.array(z.object({ airport: z.string(), city: z.string() })).min(1),
  countries: z
    .array(
      z.object({
        code: z.string(),
        name: z.string(),
        timezone: z.string(),
        cities: z.array(z.object({ name: z.string(), airports: z.array(z.string()) })).min(1),
        links: z.array(
          z.object({
            from_city: z.string(),
            to_city: z.string(),
            transfer_ids: z.array(z.string()).min(1),
          }),
        ),
      }),
    )
    .min(1),
  rules: z.object({
    min_nights: z.number().int().positive(),
    max_nights: z.number().int().positive(),
    min_nights_per_city: z.number().int().positive(),
    data_window: z.object({ first_night: date, last_departure: date }),
  }),
});
export type Destinations = z.infer<typeof destinationsSchema>;

export const airportSchema = z.object({
  code: z.string(),
  name: z.string(),
  city: z.string(),
  country: z.string(),
  timezone: z.string(),
  /** Missing for the Indian airports. */
  serves_cities: z.array(z.string()).optional(),
});
export type Airport = z.infer<typeof airportSchema>;

export const flightSchema = z.object({
  flight_id: z.string(),
  airline: z.string(),
  flight_number: z.string(),
  from: z.string(),
  to: z.string(),
  departure_local: localDateTime,
  arrival_local: localDateTime,
  stops: count,
  duration_minutes: z.number().int().positive(),
  price_per_seat: money,
  seats_left: count,
  cabin: z.string(),
});
export type Flight = z.infer<typeof flightSchema>;

export const hotelSchema = z.object({
  hotel_id: z.string(),
  name: z.string(),
  city: z.string(),
  area: z.string(),
  rating: z.number(),
  stars: z.number().int().min(1).max(5),
  check_in_from: clock,
  check_out_until: clock,
  family_friendly: z.boolean(),
  image: z.string(),
});
export type Hotel = z.infer<typeof hotelSchema>;

export const roomSchema = z.object({
  room_id: z.string(),
  hotel_id: z.string(),
  room_type: z.string(),
  name: z.string(),
  max_adults: z.number().int().positive(),
  max_children: count,
  price_per_night: money,
  refundable: z.boolean(),
});
export type Room = z.infer<typeof roomSchema>;

export const availabilitySchema = z.object({
  room_id: z.string(),
  /** The night: the date the traveler sleeps there. */
  date,
  rooms_left: count,
});
export type Availability = z.infer<typeof availabilitySchema>;

export const transferSchema = z.object({
  transfer_id: z.string(),
  type: z.enum([
    'AIRPORT_TAXI',
    'AIRPORT_VAN',
    'AIRPORT_BUS',
    'TRAIN',
    'INTERCITY_BUS',
    'INTERCITY_TAXI',
    'CITY_TAXI',
    'CITY_BUS',
  ]),
  name: z.string(),
  /** Airport transfers only. */
  airport: z.string().nullable(),
  city: z.string().nullable(),
  /** `null` serves every area of the city. */
  area: z.string().nullable(),
  from_point: z.string(),
  to_point: z.string(),
  max_passengers: z.number().int().positive(),
  service_from: clock,
  service_until: clock,
  duration_minutes: z.number().int().positive(),
  pricing: z.enum(['PER_PERSON', 'PER_VEHICLE']),
  price: money,
  /** Missing or null: children pay `price`. */
  child_price: money.nullable().optional(),
  /** Transfers between cities only. */
  from_city: z.string().optional(),
  to_city: z.string().optional(),
  /** Trains and buses between cities: one departure every N minutes inside the service window. */
  frequency_minutes: z.number().int().positive().nullable().optional(),
  door_to_door: z.boolean().nullable().optional(),
});
export type Transfer = z.infer<typeof transferSchema>;

export const attractionSchema = z.object({
  attraction_id: z.string(),
  name: z.string(),
  name_ja: z.string().nullable(),
  city: z.string(),
  category: z.string(),
  open_days: z.array(weekday).min(1),
  open_from: clock,
  open_until: clock,
  /** Extra dates when it is closed. Missing on most records. */
  closed_dates: z.array(date).optional(),
  visit_minutes: z.number().int().positive(),
  child_friendly: z.boolean(),
  accessible: z.boolean(),
  price_per_person: money,
  /** Missing: children pay `price_per_person`. */
  child_price: money.nullable().optional(),
  image: z.string(),
});
export type Attraction = z.infer<typeof attractionSchema>;
