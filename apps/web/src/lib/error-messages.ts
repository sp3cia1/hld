import { fieldErrorSchema, type FieldError } from '@bh/shared/common';
import { z } from 'zod';
import { ApiError } from './api-client';

// API error code -> what the customer reads. Add one line per code the API can return.
// The customer never sees a server message, a stack or a status code.
const messages: Record<string, string> = {
  NETWORK_ERROR: 'We could not reach the server. Check your connection and try again.',
  VALIDATION_ERROR: 'Some of the details are not valid. Please check them and try again.',
  NOT_FOUND: 'We could not find what you were looking for.',
  IDEMPOTENCY_KEY_REUSED:
    'We could not process that request. Please reload the page and try again.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again in a moment.',
  INTERNAL: 'Something went wrong on our side. Please try again.',
};

const FALLBACK = 'Something went wrong. Please try again.';

const validationDetailsSchema = z.object({ fields: z.array(fieldErrorSchema) });

/** The per-field messages of a VALIDATION_ERROR, written for the customer by the API. Empty for any other error. */
export function getFieldErrors(error: unknown): FieldError[] {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR') return [];
  const parsed = validationDetailsSchema.safeParse(error.details);
  return parsed.success ? parsed.data.fields : [];
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return messages[error.code] ?? FALLBACK;
  return FALLBACK;
}
