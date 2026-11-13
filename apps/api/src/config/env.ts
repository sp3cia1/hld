import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  TEST_DATABASE_URL: z.url(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment. Copy .env.example to .env and fix:\n${problems}`);
}

export const env = {
  ...parsed.data,
  // Tests always use their own database so they can never touch dev data.
  databaseUrl:
    parsed.data.NODE_ENV === 'test' ? parsed.data.TEST_DATABASE_URL : parsed.data.DATABASE_URL,
};
