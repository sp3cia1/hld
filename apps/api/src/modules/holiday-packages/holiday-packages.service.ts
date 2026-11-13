import type { BuildResult, HolidayRequest, Trip } from '@bh/shared/holiday-package';
import { AppError } from '../../lib/app-error';
import { runInTransaction } from '../../lib/transaction';
import { getCatalog } from '../catalog/catalog.loader';
import { buildPackage } from './logic/builder.logic';
import { freeTimeIn } from './logic/free-time.logic';
import { insertPackage, saveTrip } from './holiday-packages.repository';
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

  return {
    status: outcome.status,
    packageId: trip.trip_id,
    trip,
    budget: {
      budgetInr: trip.budget_inr,
      totalInr: trip.total_inr,
      leftInr: trip.budget_inr - trip.total_inr,
    },
    freeTime: freeTimeIn(trip, catalog),
  };
}
