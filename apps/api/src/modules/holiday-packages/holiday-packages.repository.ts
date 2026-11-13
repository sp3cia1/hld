import { tripSchema, type HolidayRequest, type Trip } from '@bh/shared/holiday-package';
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

/** The saved trip of a package, or null when no package has this id. */
export async function findTrip(id: string): Promise<Trip | null> {
  const row = await prisma.package.findUnique({ where: { id }, select: { trip: true } });
  // The column is JSON, so the stored trip is read back through the shared schema.
  return row ? tripSchema.parse(row.trip) : null;
}
