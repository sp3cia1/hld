import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../lib/app-error';
import { errorHandler } from './error-handler';
import { requestLogger } from './request-logger';

// A tiny app whose routes throw, so each error path can be checked in isolation.
const app = express();
app.use(requestLogger);
app.use(express.json());
app.get('/app-error', () => {
  throw new AppError('SOLD_OUT', 409, 'No seats left', { available: 0 });
});
app.get('/zod-error', () => {
  z.object({ quantity: z.number() }).parse({ quantity: 'two' });
});
app.get('/unknown-error', () => {
  throw new Error('password=hunter2 leaked from a driver');
});
app.post('/json', (_req, res) => {
  res.json({});
});
app.use(errorHandler);

describe('errorHandler', () => {
  it('returns an AppError as the standard envelope with the request id', async () => {
    const res = await request(app).get('/app-error').set('x-request-id', 'abc-123');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: {
        code: 'SOLD_OUT',
        message: 'No seats left',
        details: { available: 0 },
        requestId: 'abc-123',
      },
    });
  });

  it('turns a zod failure into 400 VALIDATION_ERROR with field details', async () => {
    const res = await request(app).get('/zod-error');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fields).toEqual([
      { path: 'quantity', message: expect.any(String) },
    ]);
  });

  it('hides the message of an unknown error from the client', async () => {
    const res = await request(app).get('/unknown-error');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });

  it('turns malformed JSON into 400 INVALID_JSON', async () => {
    const res = await request(app)
      .post('/json')
      .set('content-type', 'application/json')
      .send('{oops');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
