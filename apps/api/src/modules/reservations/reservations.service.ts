import { RESERVATION_NUMBER, type Reservation } from '@bh/shared/reservation';
import { randomInt } from 'node:crypto';
import { AppError } from '../../lib/app-error';
import { runInTransaction } from '../../lib/transaction';
import { getCatalog } from '../catalog/catalog.loader';
import { findPackage } from '../holiday-packages/holiday-packages.repository';
import { budgetOf } from '../holiday-packages/logic/budget.logic';
import { validateTrip } from '../holiday-packages/logic/validator.logic';
import { shortageMessage, stockNeeds } from '../stock/stock.logic';
import { takeStock } from '../stock/stock.repository';
import { bookTrip, newReference } from './reservation.logic';
import {
  findReservationByPackage,
  findReservationByReference,
  insertReservation,
  isUniqueViolation,
  type StoredReservation,
} from './reservations.repository';

/** New numbers to try before giving up. With 9 × 10⁹ possible numbers, a second try is already rare. */
const MAX_ATTEMPTS = 5;

/**
 * Confirms a saved package (M7) and uses up its seats and rooms (S2). A package has at most one reservation, so
 * confirming again, or twice at the same moment, returns the first reservation (`created: false`) instead of booking
 * twice. When someone else has already booked the last seats or rooms it needs, it is refused (409 SOLD_OUT) and
 * nothing is taken.
 */
export async function confirmPackage(
  packageId: string,
): Promise<{ reservation: Reservation; created: boolean }> {
  const existing = await findReservationByPackage(packageId);
  if (existing) return { reservation: toReservation(existing), created: false };

  const saved = await findPackage(packageId);
  if (!saved) throw new AppError('NOT_FOUND', 404, 'No package has this id');

  // Never book a package that breaks a travel rule. Over budget is allowed: it is a warning, not a rule.
  const catalog = getCatalog();
  const problems = validateTrip(saved.trip, catalog);
  if (problems.length > 0) {
    throw new AppError('PACKAGE_INVALID', 422, 'This package breaks a travel rule', { problems });
  }
  const needs = stockNeeds(saved.trip, catalog);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const reference = newReference(randomInt);
    const reservation = { reference, packageId, trip: bookTrip(saved.trip, reference) };
    try {
      // One transaction: the reservation first (its unique package stops a second confirm), then the seats and rooms.
      // Any throw takes both back, so a refused booking keeps no seats and a booking never lacks them.
      await runInTransaction(async (tx) => {
        await insertReservation(tx, reservation);
        const shortages = await takeStock(tx, needs);
        if (shortages.length > 0) {
          throw new AppError(
            'SOLD_OUT',
            409,
            'The last seats or rooms this holiday needs are already booked',
            {
              shortages: shortages.map((shortage) => ({
                message: shortageMessage(shortage, catalog),
              })),
            },
          );
        }
      });
      return { reservation: toReservation(reservation), created: true };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
    // The number or the package was taken. Another confirm of this package won the race, or the number exists:
    // only the second tries again.
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
