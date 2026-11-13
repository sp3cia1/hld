import { tripSchema, type Trip } from '@bh/shared/holiday-package';
import { flightChoicesResponseSchema } from '@bh/shared/package-change';
import { tripCheckResponseSchema } from '@bh/shared/trip-check';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../../../test/helpers';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { key } from '../catalog/catalog.logic';
import { getCatalog } from '../catalog/catalog.loader';

const app = createApp();
const catalog = getCatalog();

const menon = {
  departureAirport: 'BLR',
  country: 'JP',
  startDate: '2027-04-10',
  nights: 6,
  adults: 2,
  childAges: [6],
  budgetInr: 350000,
};

/** Builds and saves the Menon package. */
async function buildPackage(): Promise<{ packageId: string; trip: Trip }> {
  const res = await request(app).post('/api/packages').send(menon);
  return { packageId: res.body.data.packageId, trip: tripSchema.parse(res.body.data.trip) };
}

function confirm(packageId: string) {
  return request(app).post('/api/reservations').send({ packageId });
}

function itemsOf(trip: Trip, type: 'flight' | 'hotel') {
  return trip.items.filter((item) => item.type === type);
}

beforeEach(resetDatabase);

describe('S2: a confirmed reservation uses up seats and rooms', () => {
  it('takes a seat per traveler on both flights, and the rooms on every night', async () => {
    const { packageId, trip } = await buildPackage();

    expect((await confirm(packageId)).status).toBe(201);

    for (const flight of itemsOf(trip, 'flight')) {
      const row = await prisma.flightStock.findUniqueOrThrow({
        where: { flightId: flight.catalog_id },
      });
      const inCatalog = catalog.flights.get(flight.catalog_id)?.seats_left ?? 0;
      expect(row.seatsLeft).toBe(inCatalog - flight.quantity);
    }
    const [hotel] = itemsOf(trip, 'hotel');
    const roomId = hotel?.room_id ?? '';
    const row = await prisma.roomStock.findUniqueOrThrow({
      where: { roomId_night: { roomId, night: hotel?.start ?? '' } },
    });
    expect(row.roomsLeft).toBe((catalog.roomsLeft.get(key(roomId, row.night)) ?? 0) - 1);
  });

  it('takes nothing more when the same package is confirmed again', async () => {
    const { packageId, trip } = await buildPackage();
    const [arrival] = itemsOf(trip, 'flight');
    const flightId = arrival?.catalog_id ?? '';

    await confirm(packageId);
    await confirm(packageId);

    const row = await prisma.flightStock.findUniqueOrThrow({ where: { flightId } });
    expect(row.seatsLeft).toBe((catalog.flights.get(flightId)?.seats_left ?? 0) - 3);
  });
  it('refuses a booking that needs seats someone else already booked, and takes nothing', async () => {
    const { packageId, trip } = await buildPackage();
    const [arrival] = itemsOf(trip, 'flight');
    const flightId = arrival?.catalog_id ?? '';
    // Another reservation has left only 2 seats, and this family needs 3.
    await prisma.flightStock.create({ data: { flightId, seatsLeft: 2 } });

    const res = await confirm(packageId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SOLD_OUT');
    expect(res.body.error.details.shortages[0].message).toContain('3 seats');
    expect(await prisma.reservation.count()).toBe(0);
    expect((await prisma.flightStock.findUniqueOrThrow({ where: { flightId } })).seatsLeft).toBe(2);
    // The rooms and the other flight were given back with the refusal.
    expect(await prisma.roomStock.count()).toBe(0);
    expect(await prisma.flightStock.count()).toBe(1);
  });

  it('lets only one of two bookings racing for the last seats win', async () => {
    const first = await buildPackage();
    const second = await buildPackage();
    const [arrival] = itemsOf(first.trip, 'flight');
    const flightId = arrival?.catalog_id ?? '';
    // Exactly enough seats left for one family of 3.
    await prisma.flightStock.create({ data: { flightId, seatsLeft: 3 } });

    const results = await Promise.all([confirm(first.packageId), confirm(second.packageId)]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(await prisma.reservation.count()).toBe(1);
    expect((await prisma.flightStock.findUniqueOrThrow({ where: { flightId } })).seatsLeft).toBe(0);
  });

  it('builds a new package around seats that are already booked', async () => {
    const { trip } = await buildPackage();
    const [arrival] = itemsOf(trip, 'flight');
    const flightId = arrival?.catalog_id ?? '';
    await prisma.flightStock.create({ data: { flightId, seatsLeft: 0 } });

    const res = await request(app).post('/api/packages').send(menon);

    expect(res.body.data.status).not.toBe('NO_PACKAGE');
    const rebuilt = tripSchema.parse(res.body.data.trip);
    expect(itemsOf(rebuilt, 'flight').map((item) => item.catalog_id)).not.toContain(flightId);
  });

  it('never offers a flight someone else filled as a change, and refuses picking it', async () => {
    const { packageId } = await buildPackage();
    // FL-405 is another arrival the Menon family could change to (see package-changes.test.ts).
    await prisma.flightStock.create({ data: { flightId: 'FL-405', seatsLeft: 0 } });

    const choices = await request(app)
      .get(`/api/packages/${packageId}/choices/flight`)
      .query({ direction: 'arrival' });
    const change = await request(app)
      .post(`/api/packages/${packageId}/changes`)
      .send({ type: 'flight', direction: 'arrival', flightId: 'FL-405' });

    const offered = flightChoicesResponseSchema.parse(choices.body).data.choices;
    expect(offered.map((choice) => choice.flightId)).not.toContain('FL-405');
    expect(change.body.data.result).toBe('REFUSED');
  });

  it('shows the broken rule before confirm when someone else filled the flight, but not after', async () => {
    const first = await buildPackage();
    const second = await buildPackage();
    const [arrival] = itemsOf(first.trip, 'flight');
    const flightId = arrival?.catalog_id ?? '';
    await prisma.flightStock.create({ data: { flightId, seatsLeft: 3 } });

    await confirm(first.packageId);
    const booked = await request(app).get(`/api/packages/${first.packageId}/check`);
    const unbooked = await request(app).get(`/api/packages/${second.packageId}/check`);

    expect(tripCheckResponseSchema.parse(booked.body).data.problems).toEqual([]);
    const problems = tripCheckResponseSchema.parse(unbooked.body).data.problems;
    expect(problems.map((problem) => problem.message).join()).toContain('0 seats left');
  });
});
