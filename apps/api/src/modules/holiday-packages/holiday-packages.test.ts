import { buildResponseSchema, packageResponseSchema } from '@bh/shared/holiday-package';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../../../test/helpers';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';

const app = createApp();

const menon = {
  departureAirport: 'BLR',
  country: 'JP',
  startDate: '2027-04-10',
  nights: 6,
  adults: 2,
  childAges: [6],
  budgetInr: 350000,
};

beforeEach(resetDatabase);

describe('POST /api/packages', () => {
  it('saves the package and returns it with its id and budget', async () => {
    const res = await request(app).post('/api/packages').send(menon);

    expect(res.status).toBe(201);
    const { data } = buildResponseSchema.parse(res.body);
    if (data.status === 'NO_PACKAGE') throw new Error('expected a package');
    expect(data.status).toBe('OK');
    expect(data.trip.trip_id).toBe(data.packageId);
    const sum = data.trip.items.reduce((total, item) => total + item.price_inr, 0);
    expect(data.trip.total_inr).toBe(sum);
    expect(data.budget.leftInr).toBe(data.budget.budgetInr - data.budget.totalInr);
    expect(data.freeTime.map((free) => free.freeFrom)).toEqual(['2027-04-10T13:00']);

    const stored = await prisma.package.findUniqueOrThrow({ where: { id: data.packageId } });
    expect(stored.trip).toEqual(data.trip);
    expect(stored.request).toEqual(menon);
  });

  it('refuses a request with no adults, naming the field', async () => {
    const res = await request(app)
      .post('/api/packages')
      .send({ ...menon, adults: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body.error.details)).toContain('adults');
    expect(await prisma.package.count()).toBe(0);
  });

  it('refuses nights outside the limits in the data, naming the field', async () => {
    const res = await request(app)
      .post('/api/packages')
      .send({ ...menon, nights: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fields).toEqual([
      { path: 'nights', message: 'Choose 3 to 10 nights' },
    ]);
    expect(await prisma.package.count()).toBe(0);
  });

  it('says why no package is possible and saves nothing', async () => {
    const res = await request(app)
      .post('/api/packages')
      .send({ ...menon, departureAirport: 'MAA' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      status: 'NO_PACKAGE',
      reason: {
        code: 'NO_ARRIVAL_FLIGHT',
        message: 'No flight from Chennai lands in Japan on 10 Apr 2027.',
      },
    });
    expect(await prisma.package.count()).toBe(0);
  });
});

describe('GET /api/packages/:id', () => {
  it('returns a saved package exactly as it was built', async () => {
    const built = await request(app).post('/api/packages').send(menon);

    const res = await request(app).get(`/api/packages/${built.body.data.packageId}`);

    expect(res.status).toBe(200);
    expect(packageResponseSchema.parse(res.body).data).toEqual(built.body.data);
  });

  it('still returns it from a new app, as after a backend restart', async () => {
    const built = await request(app).post('/api/packages').send(menon);

    const res = await request(createApp()).get(`/api/packages/${built.body.data.packageId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.trip).toEqual(built.body.data.trip);
  });

  it('keeps the over-budget label', async () => {
    const built = await request(app)
      .post('/api/packages')
      .send({ ...menon, budgetInr: 1000 });

    const res = await request(app).get(`/api/packages/${built.body.data.packageId}`);

    expect(res.body.data.status).toBe('OVER_BUDGET');
    expect(res.body.data.budget.leftInr).toBeLessThan(0);
  });

  it('answers 404 NOT_FOUND for an id that no package has', async () => {
    const res = await request(app).get('/api/packages/no-such-package');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
