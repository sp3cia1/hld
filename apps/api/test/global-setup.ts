import { execSync } from 'node:child_process';

/**
 * Prisma 7 refuses `--force-reset` when an AI coding agent runs it, unless the user consents. This reset carries standing
 * consent because the test database is local and exists only to be wiped, so agents can run the tests without stopping.
 * Take the consent out (here and in the `db:reset` script) before this repo is ever used with real data.
 */
const RESET_CONSENT = 'yes-local-hackathon-databases-only';

/** Recreates the test database schema from schema.prisma, so a schema edit never needs a manual step. */
export function setup() {
  const testUrl = process.env.TEST_DATABASE_URL ?? '';
  const name = testUrl ? new URL(testUrl).pathname.slice(1) : '';
  // The reset runs without asking, so it must only ever hit the throwaway test database, never the dev one.
  if (!name.endsWith('_test') || testUrl === process.env.DATABASE_URL) {
    throw new Error(
      `Refusing to reset "${name}": TEST_DATABASE_URL must name a database ending in _test, separate from DATABASE_URL.`,
    );
  }
  execSync('npx prisma db push --force-reset', {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: RESET_CONSENT,
    },
    stdio: 'pipe',
  });
}
