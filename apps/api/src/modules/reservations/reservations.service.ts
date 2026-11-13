import { RESERVATION_NUMBER, type Reservation } from '@bh/shared/reservation';
import { randomInt } from 'node:crypto';
import { AppError } from '../../lib/app-error';
import { getCatalog } from '../catalog/catalog.loader';
import { budgetOf } from '../holiday-packages/logic/budget.logic';
import { findPackage } from '../holiday-packages/holiday-packages.repository';
import { validateTrip } from '../holiday-packages/logic/validator.logic';
import { bookTrip, newReference } from './reservation.logic';
import {
  findReservationByPackage,
  findReservationByReference,
  insertReservation,
  type StoredReservation,
} from './reservations.repository';

/** New numbers to try before giving up. With 9 × 10⁹ possible numbers, a second try is already rare. */
const MAX_ATTEMPTS = 5;

/**
 * Confirms a saved package (M7). A package has at most one reservation, so confirming again, or twice at the same
 * moment, returns the first reservation (`created: false`) instead of booking twice.
 */
export async function confirmPackage(
  packageId: string,
): Promise<{ reservation: Reservation; created: boolean }> {
  const existing = await findReservationByPackage(packageId);
  if (existing) return { reservation: toReservation(existing), created: false };

  const saved = await findPackage(packageId);
  if (!saved) throw new AppError('NOT_FOUND', 404, 'No package has this id');

  // Never book a package that breaks a travel rule. Over budget is allowed: it is a warning, not a rule.
  const problems = validateTrip(saved.trip, getCatalog());
  if (problems.length > 0) {
    throw new AppError('PACKAGE_INVALID', 422, 'This package breaks a travel rule', { problems });
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const reference = newReference(randomInt);
    const reservation = { reference, packageId, trip: bookTrip(saved.trip, reference) };
    if (await insertReservation(reservation)) {
      return { reservation: toReservation(reservation), created: true };
    }
    // Refused: either another confirm of this package won the race, or the number is taken. Only the second retries.
    const winner = await findReservationByPackage(packageId);
    if (winner) return { reservation: toReservation(winner), created: false };
  }
  throw new AppError('INTERNAL', 500, 'Could not find a free reservation number');
}

/** A reservation by its number. Anything that isn't a stored number, malformed ones included, is "not found". */
export async function getReservation(reference: string): Promise<Reservation> {
  const found = RESERVATION_NUMBER.test(reference)
    ? await findReservationByReference(reference)
    : null;
  if (!found) throw new AppError('NOT_FOUND', 404, 'No reservation has this number');
  return toReservation(found);
}

function toReservation({ reference, packageId, trip }: StoredReservation): Reservation {
  return { reference, packageId, trip, budget: budgetOf(trip) };
}