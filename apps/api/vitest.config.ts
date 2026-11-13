import { defineConfig } from 'vitest/config';

// Fails loudly with ENOENT if .env is missing: run `cp .env.example .env`.
process.loadEnvFile(new URL('../../.env', import.meta.url));

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    env: { NODE_ENV: 'test', LOG_LEVEL: 'silent' },
    // Integration tests share one real database, so test files run one at a time.
    fileParallelism: false,
  },
});
