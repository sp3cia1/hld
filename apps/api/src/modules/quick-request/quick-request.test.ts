import { buildResponseSchema } from '@bh/shared/holiday-package';
import { quickRequestResponseSchema } from '@bh/shared/quick-request';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../../../test/helpers';
import { createApp } from '../../app';

const app = createApp();

beforeEach(resetDatabase);

describe('POST /api/quick-request', () => {
  it('reads a request in plain words into fields that build the package', async () => {
    const res = await request(app).post('/api/quick-request').send({
      text: 'Family trip from Bangalore to Japan, 10 to 16 April, 2 adults and a 6-year-old, budget 3.5 lakh',
    });

    expect(res.status).toBe(200);
    const { fields } = quickRequestResponseSchema.parse(res.body).data;
    // Every field is there, so the form can send them as they are.
    const built = await request(app).post('/api/packages').send(fields);
    expect(built.status).toBe(201);
    expect(buildResponseSchema.parse(built.body).data.status).toBe('OK');
  });

  it.each([
    [{ text: '   ' }, 'Describe your trip'],
    [{}, 'Describe your trip'],
    [{ text: 'x'.repeat(501) }, 'Keep it under 500 characters'],
  ])('answers 400 VALIDATION_ERROR for %j', async (body, message) => {
    const res = await request(app).post('/api/quick-request').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fields[0].message).toBe(message);
  });
});
