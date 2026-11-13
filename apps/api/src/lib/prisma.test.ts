import { expect, it } from 'vitest';
import { prisma } from './prisma';

it('runs every database session in UTC, whatever the database server time zone is', async () => {
  // Without this, every stored timestamp shifts by the server's own zone (see lib/prisma.ts).
  const [row] = await prisma.$queryRaw<{ tz: string }[]>`SELECT current_setting('TimeZone') AS tz`;

  expect(row?.tz).toBe('UTC');
});
