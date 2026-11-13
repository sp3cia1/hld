import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { z } from 'zod';
import { AppError } from './app-error';

const idempotencyKeySchema = z.string().trim().min(1).max(255);

/** Reads the required `Idempotency-Key` header of a booking-style write. Call it in the controller. */
export function getIdempotencyKey(req: Request): string {
  const parsed = idempotencyKeySchema.safeParse(req.header('Idempotency-Key'));
  if (!parsed.success) {
    throw new AppError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'The Idempotency-Key header is required (1 to 255 characters)',
    );
  }
  return parsed.data;
}

/**
 * SHA-256 of a validated request body, stored next to the key. A repeat of the same key with a
 * different body is rejected. Key order comes from the zod schema, so equal bodies hash equally.
 */
export function hashRequest(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}
