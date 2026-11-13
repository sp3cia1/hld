import type { HolidayRequest, Trip } from '@bh/shared/holiday-package';
import type { Prisma } from '../../generated/prisma/client';
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
