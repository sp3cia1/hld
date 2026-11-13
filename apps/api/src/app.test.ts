import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

const app = createApp();

describe('app', () => {
  it('GET /api/health reaches the database and wraps the result in { data }', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
  });

  it('echoes an incoming x-request-id and generates one when absent', async () => {
    const withId = await request(app).get('/api/health').set('x-request-id', 'trace-42');
    const withoutId = await request(app).get('/api/health');

    expect(withId.headers['x-request-id']).toBe('trace-42');
    expect(withoutId.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('replaces an unsafe incoming x-request-id instead of logging it', async () => {
    const res = await request(app).get('/api/health').set('x-request-id', 'bad id\twith spaces');

    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns a 404 envelope for unknown routes', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });
});
