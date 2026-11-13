import type { Prisma } from '../generated/prisma/client';
import { prisma } from './prisma';

/** A database transaction handle. Services pass it to repository functions and never import Prisma. */
export type Tx = Prisma.TransactionClient;

/** Runs `work` in one transaction. If it throws, every write inside it is rolled back. */
export function runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(work);
}
