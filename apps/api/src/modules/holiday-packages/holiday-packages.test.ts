import { buildResponseSchema } from '@bh/shared/holiday-package';
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
    expect(data.trip.trip_id).toBe(data.packageId);
    const sum = data.trip.items.reduce((total, item) => total + item.price_inr, 0);
    expect(data.trip.total_inr).toBe(sum);
    expect(data.budget.leftInr).toBe(data.budget.budgetInr - data.budget.totalInr);

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
});
