import {
  holidayRequestSchema,
  tripSchema,
  type HolidayRequest,
  type Trip,
} from '@bh/shared/holiday-package';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import type { Tx } from '../../lib/transaction';

/** Saves a new package and returns its id. The trip gets its `trip_id` in `saveTrip`. */
export async function insertPackage(tx: Tx, request: HolidayRequest, trip: Omit<Trip, 'trip_id'>) {
  const created = await tx.package.create({
    data: { request: request as Prisma.InputJsonObject, trip: trip as Prisma.InputJsonObject },
    select: { id: true },
  });
  return created.id;
}

export async function saveTrip(tx: Tx, id: string, trip: Trip) {
  await tx.package.update({ where: { id }, data: { trip: trip as Prisma.InputJsonObject } });
}

/**
 * A saved package: its trip, and its reservation number if it is confirmed. Null when no package has this id.
 * The trip column is JSON, so the stored trip is read back through the shared schema.
 */
export async function findPackage(
  id: string,
): Promise<{ trip: Trip; reference: string | null } | null> {
  const row = await prisma.package.findUnique({
    where: { id },
    select: { trip: true, reservation: { select: { reference: true } } },
  });
  if (!row) return null;
  return { trip: tripSchema.parse(row.trip), reference: row.reservation?.reference ?? null };
}

/** The request a package was built from, as the traveler sent it. */
export async function findPackageRequest(id: string): Promise<HolidayRequest | null> {
  const row = await prisma.package.findUnique({ where: { id }, select: { request: true } });
  return row ? holidayRequestSchema.parse(row.request) : null;
}
