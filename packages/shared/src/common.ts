import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

/** Query params every list endpoint accepts. Feature schemas extend this with their own filters. */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

/** `sort` param: one of `fields`, ascending as `field` or descending as `-field`. */
export function sortParam(fields: readonly string[]) {
  return z.string().refine((value) => fields.includes(value.replace(/^-/, '')), {
    message: `Must be one of: ${fields.join(', ')} (prefix with - for descending)`,
  });
}

/** Splits a validated `sort` value. Call it only on values that passed `sortParam`. */
export function parseSort<F extends string>(sort: string): { field: F; direction: 'asc' | 'desc' } {
  return sort.startsWith('-')
    ? { field: sort.slice(1) as F, direction: 'desc' }
    : { field: sort as F, direction: 'asc' };
}

export const listMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type ListMeta = z.infer<typeof listMetaSchema>;

/** Every list response is `{ data: T[], meta }`. */
export function listResponseSchema<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), meta: listMetaSchema });
}

/** Every single-resource response is `{ data: T }`. */
export function dataResponseSchema<T extends z.ZodType>(item: T) {
  return z.object({ data: item });
}

export const fieldErrorSchema = z.object({ path: z.string(), message: z.string() });
export type FieldError = z.infer<typeof fieldErrorSchema>;

/** Every error response from the API. `details` for VALIDATION_ERROR is `{ fields: FieldError[] }`. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
