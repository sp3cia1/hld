import { z } from 'zod';
import { dataResponseSchema } from './common';
import { budgetSummarySchema, tripSchema } from './holiday-package';

// Contract for confirming a package (M7): POST /api/reservations creates the reservation, and
// GET /api/reservations/:reference opens it. A reservation is a snapshot: it never changes after confirm.

/** A reservation number: 10 digits, the first 1–9, kept as text so it never loses a digit. */
export const RESERVATION_NUMBER = /^[1-9]\d{9}$/;

/** The body of POST /api/reservations: the saved package to confirm. */
export const confirmRequestSchema = z.object({ packageId: z.string().min(1) });
export type ConfirmRequest = z.infer<typeof confirmRequestSchema>;

/** A confirmed package. `trip` is BOOKED, and every item carries `reference` in `booking.reference`. */
export const reservationSchema = z.object({
  reference: z.string().regex(RESERVATION_NUMBER),
  packageId: z.string(),
  trip: tripSchema,
  budget: budgetSummarySchema,
});
export type Reservation = z.infer<typeof reservationSchema>;

export const reservationResponseSchema = dataResponseSchema(reservationSchema);
export type ReservationResponse = z.infer<typeof reservationResponseSchema>;