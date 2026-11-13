import { prisma } from '../src/lib/prisma';

/** Empties the tables. Call it in `beforeEach` so tests never see each other's data. */
export async function resetDatabase() {
  await prisma.reservation.deleteMany();
  await prisma.package.deleteMany();
}
