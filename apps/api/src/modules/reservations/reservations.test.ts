import { tripSchema } from '@bh/shared/holiday-package';
import { RESERVATION_NUMBER, reservationResponseSchema } from '@bh/shared/reservation';
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

/** Builds and saves a package, and returns its id. */
async function buildPackage(budgetInr = menon.budgetInr): Promise<string> {
  const res = await request(app)
    .post('/api/packages')
    .send({ ...menon, budgetInr });
  return res.body.data.packageId;
}

function confirm(packageId: string) {
  return request(app).post('/api/reservations').send({ packageId });
}

beforeEach(resetDatabase);

describe('POST /api/reservations', () => {
  it('confirms a package: a 10-digit number, and a snapshot with every item BOOKED', async () => {
    const packageId = await buildPackage();

    const res = await confirm(packageId);

    expect(res.status).toBe(201);
    const { data } = reservationResponseSchema.parse(res.body);
    expect(data.reference).toMatch(RESERVATION_NUMBER);
    expect(data.packageId).toBe(packageId);
    expect(data.trip.status).toBe('BOOKED');
    for (const item of data.trip.items) {
      expect(item.status).toBe('BOOKED');
      expect(item.booking).toEqual({ reference: data.reference });
    }
  });

  it('returns the same reservation when the package is confirmed again', async () => {
    const packageId = await buildPackage();
    const first = await confirm(packageId);

    const second = await confirm(packageId);

    expect(second.status).toBe(200);
    expect(second.body.data).toEqual(first.body.data);
    expect(await prisma.reservation.count()).toBe(1);
  });

  it('books once when the same package is confirmed twice at the same moment', async () => {
    const packageId = await buildPackage();

    const [a, b] = await Promise.all([confirm(packageId), confirm(packageId)]);

    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.data.reference).toBe(b.body.data.reference);
    expect(await prisma.reservation.count()).toBe(1);
  });

  it('confirms a package over budget: a warning, not a rule', async () => {
    const res = await confirm(await buildPackage(1000));

    expect(res.status).toBe(201);
    expect(res.body.data.budget.leftInr).toBeLessThan(0);
  });

  it('refuses a package that breaks a travel rule, and books nothing', async () => {
    const packageId = await buildPackage();
    const stored = await prisma.package.findUniqueOrThrow({ where: { id: packageId } });
    const trip = tripSchema.parse(stored.trip);
    await prisma.package.update({
      where: { id: packageId },
      data: { trip: { ...trip, total_inr: trip.total_inr + 1 } as Prisma.InputJsonObject },
    });

    const res = await confirm(packageId);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PACKAGE_INVALID');
    expect(res.body.error.details.problems[0].rule).toBe('prices');
    expect(await prisma.reservation.count()).toBe(0);
  });

  it('answers 404 NOT_FOUND for a package that does not exist', async () => {
    const res = await confirm('no-such-package');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('refuses a request without a package id', async () => {
    const res = await request(app).post('/api/reservations').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/reservations/:reference', () => {
  it('opens the reservation by its number, also from a new app as after a backend restart', async () => {
    const confirmed = await confirm(await buildPackage());
    const { reference } = confirmed.body.data;

    const res = await request(createApp()).get(`/api/reservations/${reference}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(confirmed.body.data);
  });

  it('keeps the snapshot as it was at confirm time', async () => {
    const packageId = await buildPackage();
    const confirmed = await confirm(packageId);
    await prisma.package.update({ where: { id: packageId }, data: { trip: {} } });

    const res = await request(app).get(`/api/reservations/${confirmed.body.data.reference}`);

    expect(res.body.data.trip).toEqual(confirmed.body.data.trip);
  });

  it.each([
    ['a number no reservation has', '1234567890'],
    ['a number starting with 0', '0123456789'],
    ['a number that is too short', '12345'],
    ['letters', 'abcdefghij'],
  ])('answers 404 NOT_FOUND for %s', async (_, reference) => {
    const res = await request(app).get(`/api/reservations/${reference}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/packages/:id after confirm', () => {
  it('shows the reservation number on the package', async () => {
    const packageId = await buildPackage();
    expect((await request(app).get(`/api/packages/${packageId}`)).body.data.reference).toBeNull();

    const confirmed = await confirm(packageId);
    const res = await request(app).get(`/api/packages/${packageId}`);

    expect(res.body.data.reference).toBe(confirmed.body.data.reference);
  });
});