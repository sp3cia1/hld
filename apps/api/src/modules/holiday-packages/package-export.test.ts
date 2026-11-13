import { tripSchema } from '@bh/shared/holiday-package';
import { tripExportResponseSchema } from '@bh/shared/trip-export';
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

describe('GET /api/packages/:id/export', () => {
  it('exports a planned package in the shared trip format', async () => {
    const packageId = await buildPackage();

    const res = await request(app).get(`/api/packages/${packageId}/export`);

    expect(res.status).toBe(200);
    const { data } = tripExportResponseSchema.parse(res.body);
    expect(data.trip_id).toBe(packageId);
    expect(data.country).toBe('Japan');
    expect(data.status).toBe('PLANNED');
    expect(data.total_inr).toBe(data.items.reduce((sum, item) => sum + item.price_inr, 0));
    for (const item of data.items) {
      expect(item.status).toBe('PLANNED');
      expect(item.booking).toBeNull();
      expect(item.sources).toEqual([]);
      expect(item.room_id !== null).toBe(item.type === 'hotel');
    }
  });

  it('exports the booked snapshot after confirm, every item carrying the reservation number', async () => {
    const packageId = await buildPackage();
    const confirmed = await request(app).post('/api/reservations').send({ packageId });
    const { reference } = confirmed.body.data;

    const res = await request(app).get(`/api/packages/${packageId}/export`);

    const { data } = tripExportResponseSchema.parse(res.body);
    expect(data.status).toBe('BOOKED');
    for (const item of data.items) {
      expect(item.status).toBe('BOOKED');
      expect(item.booking).toEqual({ reference });
    }
  });

  it('refuses to export a package that breaks a travel rule', async () => {
    const packageId = await buildPackage();
    const stored = await prisma.package.findUniqueOrThrow({ where: { id: packageId } });
    const trip = tripSchema.parse(stored.trip);
    await prisma.package.update({
      where: { id: packageId },
      data: { trip: { ...trip, total_inr: trip.total_inr + 1 } as Prisma.InputJsonObject },
    });

    const res = await request(app).get(`/api/packages/${packageId}/export`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PACKAGE_INVALID');
  });

  it('answers 404 NOT_FOUND for a package that does not exist', async () => {
    const res = await request(app).get('/api/packages/no-such-package/export');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
