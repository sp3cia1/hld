import { tripSchema } from '@bh/shared/holiday-package';
import {
  changeResponseSchema,
  flightChoicesResponseSchema,
  hotelChoicesResponseSchema,
} from '@bh/shared/package-change';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDatabase } from '../../../test/helpers';
import { createApp } from '../../app';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';

// Lets a test act between the moment a change reads the package and the moment it saves it, as another tab would.
const afterRead = vi.hoisted(() => ({ run: async () => {} }));
vi.mock('./package-changes.repository', async (importOriginal) => {
  const real = await importOriginal<typeof import('./package-changes.repository')>();
  return {
    ...real,
    findTripWithVersion: async (id: string) => {
      const found = await real.findTripWithVersion(id);
      await afterRead.run();
      return found;
    },
  };
});

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
const lateFlight = { type: 'flight', direction: 'arrival', flightId: 'FL-405' };
const asakusa = { type: 'hotel', city: 'Tokyo', hotelId: 'HTL-TYO-003', roomId: 'RM-TYO-003-C' };

beforeEach(async () => {
  await resetDatabase();
  afterRead.run = async () => {};
});

describe('GET /api/packages/:id/choices', () => {
  it('lists the hotel choices of a city and the flight choices of each direction', async () => {
    const id = await build(menon);

    const hotels = await request(app)
      .get(`/api/packages/${id}/choices/hotel`)
      .query({ city: 'Tokyo' });
    const arrivals = await request(app)
      .get(`/api/packages/${id}/choices/flight`)
      .query({ direction: 'arrival' });
    const returns = await request(app)
      .get(`/api/packages/${id}/choices/flight`)
      .query({ direction: 'return' });

    expect([hotels.status, arrivals.status, returns.status]).toEqual([200, 200, 200]);
    expect(hotelChoicesResponseSchema.parse(hotels.body).data.choices[0]).toMatchObject({
      roomId: 'RM-TYO-004-B',
      current: true,
    });
    expect(flightChoicesResponseSchema.parse(arrivals.body).data.choices[0]!.flightId).toBe(
      'FL-401',
    );
    expect(flightChoicesResponseSchema.parse(returns.body).data.choices[0]!.flightId).toBe(
      'FL-412',
    );
  });

  it('answers 400 for a city that is not in the plan', async () => {
    const id = await build(menon);

    const res = await request(app)
      .get(`/api/packages/${id}/choices/hotel`)
      .query({ city: 'Kyoto' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fields).toEqual([
      { path: 'city', message: 'Kyoto is not a city of this holiday' },
    ]);
  });

  it('answers 404 for a package that does not exist', async () => {
    const res = await request(app).get('/api/packages/no-such-package/choices/flight').query({
      direction: 'arrival',
    });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/packages/:id/changes', () => {
  it('applies a change, saves it and returns the package as GET now shows it', async () => {
    const id = await build(menon);

    const res = await request(app).post(`/api/packages/${id}/changes`).send(lateFlight);

    expect(res.status).toBe(200);
    const { data } = changeResponseSchema.parse(res.body);
    if (data.result !== 'APPLIED') throw new Error(JSON.stringify(data.problems));
    expect(data.package.trip.items[0]!.catalog_id).toBe('FL-405');
    expect(data.package.budget.totalInr).toBe(223944);
    expect((await request(app).get(`/api/packages/${id}`)).body.data).toEqual(data.package);
  });

  it('refuses a change that breaks a rule, with the reason, and keeps the package as it was', async () => {
    const id = await build(menon);
    const before = await request(app).get(`/api/packages/${id}`);

    const res = await request(app)
      .post(`/api/packages/${id}/changes`)
      .send({ type: 'flight', direction: 'arrival', flightId: 'FL-740' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      result: 'REFUSED',
      problems: [
        { rule: 'flights', itemId: 'i1', message: "KIX doesn't serve Tokyo, the first city" },
      ],
    });
    expect((await request(app).get(`/api/packages/${id}`)).body).toEqual(before.body);
  });

  it('applies a change that goes over budget, and labels the package', async () => {
    // Built within ₹2,20,000 at ₹2,19,324. The late flight with its taxi costs ₹2,23,944.
    const id = await build({ ...menon, budgetInr: 220000 });

    const res = await request(app).post(`/api/packages/${id}/changes`).send(lateFlight);

    expect(res.body.data.result).toBe('APPLIED');
    expect(res.body.data.package).toMatchObject({
      status: 'OVER_BUDGET',
      budget: { totalInr: 223944, leftInr: -3944 },
    });
  });

  it.each([
    ['a body that is not a change', { type: 'hotel', city: 'Tokyo' }, 'hotelId'],
    ['a flight that is not in the catalog', { ...lateFlight, flightId: 'FL-0' }, 'flightId'],
    ['a room of another hotel', { ...asakusa, roomId: 'RM-TYO-004-B' }, 'roomId'],
    ['a city that is not in the plan', { ...asakusa, city: 'Kyoto' }, 'city'],
  ])('answers 400 for %s', async (_, body, field) => {
    const id = await build(menon);

    const res = await request(app).post(`/api/packages/${id}/changes`).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fields.map((f: { path: string }) => f.path)).toContain(field);
  });

  it('answers 404 for a package that does not exist', async () => {
    const res = await request(app).post('/api/packages/no-such-package/changes').send(lateFlight);

    expect(res.status).toBe(404);
  });

  it('answers 409 PACKAGE_CONFIRMED for a confirmed package', async () => {
    const id = await build(menon);
    // Confirming isn't built yet. It will save the trip as BOOKED, so do that here.
    const stored = await prisma.package.findUniqueOrThrow({ where: { id } });
    const booked = { ...tripSchema.parse(stored.trip), status: 'BOOKED' };
    await prisma.package.update({
      where: { id },
      data: { trip: booked as Prisma.InputJsonObject },
    });

    const res = await request(app).post(`/api/packages/${id}/changes`).send(lateFlight);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PACKAGE_CONFIRMED');
  });

  it('answers 409 PACKAGE_CHANGED when another tab saved first, and keeps that tab’s change', async () => {
    const id = await build(menon);
    // Another tab moves to Asakusa after this change has read the package and before it saves.
    afterRead.run = async () => {
      afterRead.run = async () => {};
      const other = await request(app).post(`/api/packages/${id}/changes`).send(asakusa);
      expect(other.body.data.result).toBe('APPLIED');
    };

    const res = await request(app).post(`/api/packages/${id}/changes`).send(lateFlight);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PACKAGE_CHANGED');
    const { items } = (await request(app).get(`/api/packages/${id}`)).body.data.trip;
    expect(items.find((item: { type: string }) => item.type === 'hotel').catalog_id).toBe(
      'HTL-TYO-003',
    );
    expect(items[0].catalog_id).toBe('FL-401');
  });
});

async function build(body: typeof menon): Promise<string> {
  const res = await request(app).post('/api/packages').send(body);
  expect(res.status).toBe(201);
  return res.body.data.packageId;
}
