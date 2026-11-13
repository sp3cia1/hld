import type { BuildResult, HolidayRequest, Trip } from '@bh/shared/holiday-package';
import { runInTransaction } from '../../lib/transaction';
import { insertPackage, saveTrip } from './holiday-packages.repository';
import { MENON_EXAMPLE_TRIP } from './menon-example';

/**
 * Builds and saves a package for the request.
 * For now it always returns the fixed Menon example, whatever the request says; the builder replaces it.
 */
export async function createPackage(request: HolidayRequest): Promise<BuildResult> {
  const trip = await runInTransaction(async (tx) => {
    const id = await insertPackage(tx, request, MENON_EXAMPLE_TRIP);
    const saved: Trip = { ...MENON_EXAMPLE_TRIP, trip_id: id };
    await saveTrip(tx, id, saved);
    return saved;
  });

  const budget = {
    budgetInr: trip.budget_inr,
    totalInr: trip.total_inr,
    leftInr: trip.budget_inr - trip.total_inr,
  };
  return {
    status: budget.leftInr >= 0 ? 'OK' : 'OVER_BUDGET',
    packageId: trip.trip_id,
    trip,
    budget,
  };
}
