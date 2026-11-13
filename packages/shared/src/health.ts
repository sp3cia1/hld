import { z } from 'zod';
import { dataResponseSchema } from './common';

export const healthResponseSchema = dataResponseSchema(z.object({ status: z.literal('ok') }));
export type HealthResponse = z.infer<typeof healthResponseSchema>;
