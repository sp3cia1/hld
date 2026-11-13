import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: env.databaseUrl,
    // The driver sends dates without a zone, and Postgres reads them in the session time zone.
    // Without this, every timestamp is shifted by the database server's own setting (+5:30 on a
    // machine configured for India). UTC makes stored times identical on every machine.
    options: '-c TimeZone=UTC',
  }),
});
