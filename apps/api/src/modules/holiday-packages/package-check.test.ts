import { tripSchema } from '@bh/shared/holiday-package';
import { RULE_IDS, tripCheckResponseSchema } from '@bh/shared/trip-check';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../../../test/helpers';
import { createApp } from '../../app';
import type { Prisma } from '../../generated/prisma/client';
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

/** Builds and saves the Menon package, and returns its id. */
async function buildPackage(): Promise<string> {
  const res = await request(app).post('/api/packages').send(menon);
  return res.body.data.packageId;
}

beforeEach(resetDatabase);

describe('GET /api/packages/:id/check', () => {
  it('lists every travel rule, all passing for a package the builder made', async () => {
    const res = await request(app).get(`/api/packages/${await buildPackage()}/check`);

    expect(res.status).toBe(200);
    const { data } = tripCheckResponseSchema.parse(res.body);
    expect(data.rules.map((rule) => rule.id)).toEqual(RULE_IDS);
    expect(data.rules.every((rule) => rule.passed)).toBe(true);
    expect(data.problems).toEqual([]);
  });

  it('shows which rule a broken package fails, and why', async () => {
    const packageId = await buildPackage();
    const stored = await prisma.package.findUniqueOrThrow({ where: { id: packageId } });
    const trip = tripSchema.parse(stored.trip);
    await prisma.package.update({
      where: { id: packageId },
      data: { trip: { ...trip, total_inr: trip.total_inr + 1 } as Prisma.InputJsonObject },
    });

    const res = await request(app).get(`/api/packages/${packageId}/check`);

    const { data } = tripCheckResponseSchema.parse(res.body);
    expect(data.rules.filter((rule) => !rule.passed).map((rule) => rule.id)).toEqual(['prices']);
    expect(data.problems[0]?.message).toContain('add up to');
  });

  it('answers 404 NOT_FOUND for a package that does not exist', async () => {
    const res = await request(app).get('/api/packages/no-such-package/check');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
