import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { getCatalog } from './modules/catalog/catalog.loader';

try {
  await prisma.$queryRaw`SELECT 1`;
} catch (err) {
  logger.fatal({ err }, 'Cannot reach the database. Is Postgres running and DATABASE_URL correct?');
  process.exit(1);
}

try {
  getCatalog();
} catch (err) {
  logger.fatal(
    { err },
    'Cannot load the catalog in data/. The data files must match DATA_DICTIONARY.md.',
  );
  process.exit(1);
}

createApp().listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});
