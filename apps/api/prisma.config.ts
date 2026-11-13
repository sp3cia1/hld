import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

const envFile = new URL('../../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Same rule as src/config/env.ts: tests use TEST_DATABASE_URL so they can never touch dev data.
const url =
  process.env.NODE_ENV === 'test' ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url },
});
