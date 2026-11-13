import { tripSchema, type Trip } from '@bh/shared/holiday-package';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import type { Tx } from '../../lib/transaction';

/** A reservation as stored: its number, its package, and the booked trip at confirm time. */
export type StoredReservation = { reference: string; packageId: string; trip: Trip };

const columns = { reference: true, packageId: true, trip: true } as const;

export async function findReservationByReference(
  reference: string,
): Promise<StoredReservation | null> {
  const row = await prisma.reservation.findUnique({ where: { reference }, select: columns });
  return row ? { ...row, trip: tripSchema.parse(row.trip) } : null;
}

export async function findReservationByPackage(
  packageId: string,
): Promise<StoredReservation | null> {
  const row = await prisma.reservation.findUnique({ where: { packageId }, select: columns });
  return row ? { ...row, trip: tripSchema.parse(row.trip) } : null;
}

/**
 * Saves a reservation inside the confirm transaction. Throws a unique violation (see `isUniqueViolation`) when its
 * number or its package already has a reservation: both are unique in the database, so two confirms can't both win.
 */
export async function insertReservation(tx: Tx, reservation: StoredReservation): Promise<void> {
  await tx.reservation.create({
    data: { ...reservation, trip: reservation.trip as Prisma.InputJsonObject },
  });
}

/** Prisma's error code for a unique constraint that a write would break. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}
