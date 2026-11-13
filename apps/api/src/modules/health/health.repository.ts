import { prisma } from '../../lib/prisma';

/** Throws if the database cannot be reached. */
export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
