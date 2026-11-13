import { z } from 'zod';
import { dataResponseSchema } from './common';

// Contract for POST /api/quick-request (S1): the traveler describes the holiday in their own words, and the API reads
// it with rules (no AI) into the fields of the request form. It never guesses: a field the text doesn't give, or
// gives in a way that could mean two things, is left out, and a note says what to check. The form checks the values
// against the data on Build, as it does for typed ones.

export const quickRequestSchema = z.object({
  text: z
    .string({ error: 'Describe your trip' })
    .trim()
    .min(1, 'Describe your trip')
    .max(500, 'Keep it under 500 characters'),
});
export type QuickRequest = z.infer<typeof quickRequestSchema>;

/** The request fields, any of them missing. The same names and units as `HolidayRequest`. */
export const quickRequestFieldsSchema = z
  .object({
    departureAirport: z.string(),
    country: z.string(),
    startDate: z.iso.date(),
    nights: z.number().int(),
    adults: z.number().int(),
    childAges: z.array(z.number().int()),
    budgetInr: z.number().int(),
  })
  .partial();
export type QuickRequestFields = z.infer<typeof quickRequestFieldsSchema>;
export type QuickRequestField = keyof QuickRequestFields;

export const quickRequestResultSchema = z.object({
  /** What the text says, field by field. `childAges` is set whenever the text says how many children travel. */
  fields: quickRequestFieldsSchema,
  /** Children the text counts without an age ("2 kids"). The form adds them after `childAges`, age empty. */
  childrenWithoutAges: z.number().int().nonnegative(),
  /** What to check, in the traveler's words: a reading the app made, a question, or something it can't use. */
  notes: z.array(z.string()),
});
export type QuickRequestResult = z.infer<typeof quickRequestResultSchema>;

export const quickRequestResponseSchema = dataResponseSchema(quickRequestResultSchema);
export type QuickRequestResponse = z.infer<typeof quickRequestResponseSchema>;
