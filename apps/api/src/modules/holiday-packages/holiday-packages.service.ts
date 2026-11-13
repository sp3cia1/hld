import type { BuildResult, HolidayRequest, SavedPackage, Trip } from '@bh/shared/holiday-package';
import { AppError } from '../../lib/app-error';
import { runInTransaction } from '../../lib/transaction';
import { getCatalog } from '../catalog/catalog.loader';
import { findPackage, insertPackage, saveTrip } from './holiday-packages.repository';
import { budgetOf } from './logic/budget.logic';
import { buildPackage } from './logic/builder.logic';
import { freeTimeIn } from './logic/free-time.logic';
import { checkRequest } from './logic/request.logic';

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
 * The package with its total against the budget (M5), its reservation number once confirmed, and the free time on
 * the days it leaves open. It is OVER_BUDGET exactly when the total is above the budget: at build time that is the
 * case only when no package fits (M8), and a total equal to the budget is within it.
 */
function toSavedPackage(trip: Trip, reference: string | null): SavedPackage {
  return {
    status: trip.total_inr <= trip.budget_inr ? 'OK' : 'OVER_BUDGET',
    packageId: trip.trip_id,
    trip,
    budget: budgetOf(trip),
    reference,
    freeTime: freeTimeIn(trip, getCatalog()),
  };
}