import express from 'express';
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';
import { AppError } from '../lib/app-error';
import { errorHandler } from './error-handler';
import { requestLogger } from './request-logger';

// Replace the shared logger with one that records every line, so the log output can be asserted.
type LogLine = {
  req: { requestId: string; method: string; path: string };
  res: { status: number };
  responseTime: number;
  err?: { stack: string };
};
const logged = vi.hoisted(() => ({ lines: [] as LogLine[] }));
vi.mock('../lib/logger', async () => {
  const { pino } = await import('pino');
  const stream = { write: (line: string) => void logged.lines.push(JSON.parse(line)) };
  return { logger: pino({ level: 'info' }, stream) };
});

const app = express();
app.use(requestLogger);
app.get('/ok', (_req, res) => {
  res.json({});
});
app.get('/db-down', () => {
  throw new AppError('SERVICE_UNAVAILABLE', 503, 'Database is unavailable', undefined, {
    cause: new Error('connect ECONNREFUSED'),
  });
});
app.use(errorHandler);

beforeEach(() => {
  logged.lines.length = 0;
});

it('logs one line per request with method, path, status, duration and requestId', async () => {
  await request(app).get('/ok').set('x-request-id', 'trace-9');

  await vi.waitFor(() => expect(logged.lines).toHaveLength(1));
  expect(logged.lines[0]).toMatchObject({
    req: { requestId: 'trace-9', method: 'GET', path: '/ok' },
    res: { status: 200 },
    responseTime: expect.any(Number),
  });
});

it('logs a server error with its stack and cause, tagged with the same requestId', async () => {
  await request(app).get('/db-down').set('x-request-id', 'trace-10');

  await vi.waitFor(() => expect(logged.lines.length).toBeGreaterThanOrEqual(2));
  const errorLine = logged.lines.find((line) => line.err);
  expect(errorLine).toMatchObject({ req: { requestId: 'trace-10' } });
  expect(errorLine?.err?.stack).toContain('AppError');
  expect(JSON.stringify(errorLine?.err)).toContain('ECONNREFUSED');
});
