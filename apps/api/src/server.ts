import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

try {
  await prisma.$queryRaw`SELECT 1`;
} catch (err) {
  logger.fatal({ err }, 'Cannot reach the database. Is Postgres running and DATABASE_URL correct?');
  process.exit(1);
}

createApp().listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});
