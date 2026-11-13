import { pino } from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  // Readable output while developing. Plain JSON everywhere else.
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});
