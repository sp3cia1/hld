import type { FieldError } from '@bh/shared/common';
import type {
  ChangeRequest,
  ChangeResult,
  FlightChoices,
  FlightDirection,
  HotelChoices,
} from '@bh/shared/package-change';
import { AppError } from '../../lib/app-error';
import { getCatalog } from '../catalog/catalog.loader';
import { toSavedPackage } from '../holiday-packages/holiday-packages.service';
import { checkChange, checkCity, tryChange } from './change.logic';
import { flightChoices, hotelChoices } from './choices.logic';
import { findTripWithVersion, saveTripIfUnchanged } from './package-changes.repository';

/** The hotel choices in a city of the package's plan, each with what picking it would do. */
export async function getHotelChoices(packageId: string, city: string): Promise<HotelChoices> {
  const { trip } = await loadPackage(packageId);
  throwIfInvalid(checkCity(trip, city));
  return hotelChoices(trip, city, getCatalog());
}

/** The arrival or return flight choices, each with what picking it would do. */
export async function getFlightChoices(
  packageId: string,
  direction: FlightDirection,
): Promise<FlightChoices> {
  const { trip } = await loadPackage(packageId);
  return flightChoices(trip, direction, getCatalog());
}

/**
 * One change to a saved package (M6). The change is tried on a copy and the whole package checked again: saved and
 * APPLIED, or REFUSED with every rule it would break and nothing saved. Being over budget never refuses a change; the
 * package comes back labelled OVER_BUDGET instead. A change says what to set ("this hotel"), so repeating it gives
 * the same package: it needs no Idempotency-Key.
 */
export async function applyChange(packageId: string, change: ChangeRequest): Promise<ChangeResult> {
  const { trip, updatedAt } = await loadPackage(packageId);
  if (trip.status === 'BOOKED') {
    throw new AppError(
      'PACKAGE_CONFIRMED',
      409,
      'This holiday is confirmed, so it can no longer be changed',
    );
  }
  const catalog = getCatalog();
  throwIfInvalid(checkChange(trip, change, catalog));

  const outcome = tryChange(trip, change, catalog);
  if (!outcome.ok) return { result: 'REFUSED', problems: outcome.problems };

  // Saved only if nobody saved the package since it was read, so a change made in another tab is never lost.
  if (!(await saveTripIfUnchanged(packageId, outcome.trip, updatedAt))) {
    throw new AppError('PACKAGE_CHANGED', 409, 'This holiday changed in another tab. Reload it.');
  }
  return { result: 'APPLIED', package: toSavedPackage(outcome.trip) };
}

async function loadPackage(id: string) {
  const found = await findTripWithVersion(id);
  if (!found) throw new AppError('NOT_FOUND', 404, 'No package has this id');
  return found;
}

function throwIfInvalid(fields: FieldError[]) {
  if (fields.length > 0) {
    throw new AppError('VALIDATION_ERROR', 400, 'Some fields are invalid', { fields });
  }
}
