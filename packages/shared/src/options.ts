import { z } from 'zod';
import { dataResponseSchema } from './common';

// Contract for GET /api/options: the choices of the request form (M1), taken from destinations.json.

export const optionsSchema = z.object({
  departureCities: z.array(z.object({ airport: z.string(), city: z.string() })),
  countries: z.array(z.object({ code: z.string(), name: z.string() })),
});
export type Options = z.infer<typeof optionsSchema>;

export const optionsResponseSchema = dataResponseSchema(optionsSchema);
export type OptionsResponse = z.infer<typeof optionsResponseSchema>;
