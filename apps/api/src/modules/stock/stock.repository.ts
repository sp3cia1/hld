import { prisma } from '../../lib/prisma';
import type { Tx } from '../../lib/transaction';
import { key } from '../catalog/catalog.logic';
import type { Shortage, StockNeeds } from './stock.logic';

/**
 * Seats and rooms left after bookings, only for the flights and room nights a booking has touched. Room keys are
 * `key(roomId, night)`, the same as the catalog's `roomsLeft`.
 */
export async function loadBookedStock(): Promise<{
  seatsLeft: Map<string, number>;
  roomsLeft: Map<string, number>;
}> {
  const [flights, rooms] = await Promise.all([
    prisma.flightStock.findMany(),
    prisma.roomStock.findMany(),
  ]);
  return {
    seatsLeft: new Map(flights.map((row) => [row.flightId, row.seatsLeft])),
    roomsLeft: new Map(rooms.map((row) => [key(row.roomId, row.night), row.roomsLeft])),
  };
}

/**
 * Takes the seats and rooms a booking needs, each only if enough are left: an atomic conditional decrement, never a
 * read-then-write, so two bookings can't both take the last seats. A row starts at the catalog's number the first
 * time a booking needs it. Returns what wasn't there; the caller throws, and the transaction gives back what it took.
 */
export async function takeStock(tx: Tx, needs: StockNeeds): Promise<Shortage[]> {
  await tx.flightStock.createMany({
    data: needs.seats.map((need) => ({ flightId: need.flightId, seatsLeft: need.inCatalog })),
    skipDuplicates: true,
  });
  await tx.roomStock.createMany({
    data: needs.rooms.map((need) => ({
      roomId: need.roomId,
      night: need.night,
      roomsLeft: need.inCatalog,
    })),
    skipDuplicates: true,
  });

  const shortages: Shortage[] = [];
  for (const need of needs.seats) {
    const { count } = await tx.flightStock.updateMany({
      where: { flightId: need.flightId, seatsLeft: { gte: need.seats } },
      data: { seatsLeft: { decrement: need.seats } },
    });
    if (count === 0) shortages.push({ kind: 'seats', need });
  }
  for (const need of needs.rooms) {
    const { count } = await tx.roomStock.updateMany({
      where: { roomId: need.roomId, night: need.night, roomsLeft: { gte: need.rooms } },
      data: { roomsLeft: { decrement: need.rooms } },
    });
    if (count === 0) shortages.push({ kind: 'rooms', need });
  }
  return shortages;
}
