import { tripSchema, type Trip } from '@bh/shared/holiday-package';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';

/** The saved trip of a package and when it was last saved, or null when no package has this id. */
export async function findTripWithVersion(
  id: string,
): Promise<{ trip: Trip; updatedAt: Date } | null> {
  const row = await prisma.package.findUnique({
    where: { id },
    select: { trip: true, updatedAt: true },
  });
  // The column is JSON, so the stored trip is read back through the shared schema.
  return row ? { trip: tripSchema.parse(row.trip), updatedAt: row.updatedAt } : null;
}

/**
 * Saves the changed trip only if the package is still as it was read (`updatedAt` unchanged), in one conditional
 * update, so two tabs can never overwrite each other's change. False when someone saved it in between.
 */
export async function saveTripIfUnchanged(
  id: string,
  trip: Trip,
  updatedAt: Date,
): Promise<boolean> {
  const { count } = await prisma.package.updateMany({
    where: { id, updatedAt },
    data: { trip: trip as Prisma.InputJsonObject },
  });
  return count === 1;
}
