import type { BuildResult, HolidayRequest, SavedPackage, Trip } from '@bh/shared/holiday-package';
import type { TripCheck } from '@bh/shared/trip-check';
import { AppError } from '../../lib/app-error';
import { runInTransaction } from '../../lib/transaction';
import { getCatalog } from '../catalog/catalog.loader';
import { findReservationByPackage } from '../reservations/reservations.repository';
import { findPackage, insertPackage, saveTrip } from './holiday-packages.repository';
import { budgetOf } from './logic/budget.logic';
import { buildPackage } from './logic/builder.logic';
import { freeTimeIn } from './logic/free-time.logic';
import { checkRequest } from './logic/request.logic';
import { checkTrip, validateTrip } from './logic/validator.logic';

/**
 * Checks the request against the data, builds the package, and saves it unless none is possible. A package comes
 * back with the free time on the days it leaves open.
 */
export async function createPackage(request: HolidayRequest): Promise<BuildResult> {
  const catalog = getCatalog();

  const fields = checkRequest(request, catalog);
  if (fields.length > 0) {
    throw new AppError('VALIDATION_ERROR', 400, 'Some fields are invalid', { fields });
  }

  const outcome = buildPackage(request, catalog);
  if (outcome.status === 'NO_PACKAGE') return outcome;

  const trip = await runInTransaction(async (tx) => {
    const id = await insertPackage(tx, request, outcome.trip);
    const saved: Trip = { ...outcome.trip, trip_id: id };
    await saveTrip(tx, id, saved);
    return saved;
  });

  return toSavedPackage(trip, null);
}

/** A saved package by its id. A refresh, a shared link and a backend restart all read it from here. */
export async function getPackage(id: string): Promise<SavedPackage> {
  const saved = await findPackage(id);
  if (!saved) throw new AppError('NOT_FOUND', 404, 'No package has this id');
  return toSavedPackage(saved.trip, saved.reference);
}

/**
 * Every travel rule (§4) with whether the saved package passes it, for the rules panel. The validator is separate
 * from the builder, so this is a second check of what the builder made, and of every change after it.
 */
export async function getPackageCheck(id: string): Promise<TripCheck> {
  const saved = await findPackage(id);
  if (!saved) throw new AppError('NOT_FOUND', 404, 'No package has this id');
  return checkTrip(saved.trip, getCatalog());
}

/**
 * The package for the JSON export, in the shared trip format. Once confirmed it is the booked snapshot, so the file
 * matches the reservation. Checked by the validator first: a package that breaks a rule is never exported.
 */
export async function exportPackage(id: string): Promise<Trip> {
  const saved = await findPackage(id);
  if (!saved) throw new AppError('NOT_FOUND', 404, 'No package has this id');

  const reservation = saved.reference ? await findReservationByPackage(id) : null;
  const trip = reservation?.trip ?? saved.trip;

  const problems = validateTrip(trip, getCatalog());
  if (problems.length > 0) {
    throw new AppError('PACKAGE_INVALID', 422, 'This package breaks a travel rule', { problems });
  }
  return trip;
}

/**
 * The package with its total against the budget (M5), its reservation number once confirmed, and the free time on
 * the days it leaves open. It is OVER_BUDGET exactly when the total is above the budget: at build time that is the
 * case only when no package fits (M8), after a change also when the traveler's choices cost more. A total equal to
 * the budget is within it. A built, a loaded and a changed package all go through here.
 */
export function toSavedPackage(trip: Trip, reference: string | null): SavedPackage {
  return {
    status: trip.total_inr <= trip.budget_inr ? 'OK' : 'OVER_BUDGET',
    packageId: trip.trip_id,
    trip,
    budget: budgetOf(trip),
    reference,
    freeTime: freeTimeIn(trip, getCatalog()),
  };
}
