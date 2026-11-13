import { RESERVATION_NUMBER } from '@bh/shared/reservation';
import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getCatalog } from '../catalog/catalog.loader';
import { MENON_EXAMPLE_TRIP } from '../holiday-packages/menon-example';
import { validateTrip } from '../holiday-packages/validator.logic';
import { bookTrip, newReference } from './reservation.logic';

const menon = { ...MENON_EXAMPLE_TRIP, trip_id: 'package-1' };

describe('newReference', () => {
  it('never starts with 0: the lowest number is 1000000000', () => {
    expect(newReference((min) => min)).toBe('1000000000');
  });

  it('can reach 9999999999', () => {
    expect(newReference((_, max) => max - 1)).toBe('9999999999');
  });

  it('always makes 10 digits with a first digit from 1 to 9', () => {
    for (let i = 0; i < 1000; i++) expect(newReference(randomInt)).toMatch(RESERVATION_NUMBER);
  });
});

describe('bookTrip', () => {
  const booked = bookTrip(menon, '4821937560');

  it('books the trip and every item, each carrying the reservation number', () => {
    expect(booked.status).toBe('BOOKED');
    for (const item of booked.items) {
      expect(item.status).toBe('BOOKED');
      expect(item.booking).toEqual({ reference: '4821937560' });
    }
  });

  it('changes nothing else, and leaves the planned trip as it was', () => {
    const unbooked = booked.items.map((item) => ({ ...item, status: 'PLANNED', booking: null }));
    expect(unbooked).toEqual(menon.items);
    expect(menon.status).toBe('PLANNED');
    expect(menon.items.every((item) => item.booking === null)).toBe(true);
  });

  it('gives a booked trip that still passes every travel rule', () => {
    expect(validateTrip(booked, getCatalog())).toEqual([]);
  });
});