import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { createApp } from '../../app';

vi.mock('./health.repository', () => ({
  pingDatabase: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432')),
}));

it('GET /api/health returns 503 SERVICE_UNAVAILABLE when the database is down, without leaking the cause', async () => {
  const res = await request(createApp()).get('/api/health');

  expect(res.status).toBe(503);
  expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
});
