import type { Trip } from '@bh/shared/holiday-package';

const REFERENCE_LENGTH = 10;

/**
 * A new reservation number: 10 digits, the first 1–9, so it never loses a digit wherever it is read as a number.
 * `randomInt(min, max)` returns a whole number from min up to max - 1, like `crypto.randomInt`. It is a parameter so
 * tests can choose the digits. The database's unique constraint decides whether the number is free.
 */
export function newReference(randomInt: (min: number, max: number) => number): string {
  let reference = String(randomInt(1, 10));
  while (reference.length < REFERENCE_LENGTH) reference += String(randomInt(0, 10));
  return reference;
}

/** The trip as confirmed: the trip and every item BOOKED, each item carrying the reservation number. */
export function bookTrip(trip: Trip, reference: string): Trip {
  return {
    ...trip,
    status: 'BOOKED',
    items: trip.items.map((item) => ({
      ...item,
      status: 'BOOKED' as const,
      booking: { reference },
    })),
  };
}