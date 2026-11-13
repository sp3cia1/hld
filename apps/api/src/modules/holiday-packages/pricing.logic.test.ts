import { describe, expect, it } from 'vitest';
import type { Attraction, Transfer } from '../catalog/catalog.schemas';
import { attractionPrice, transferPrice, transferQuantity } from './pricing.logic';

const inr = (amount: number) => ({ amount, currency: 'INR' as const });
const party = { adults: 2, children: 1 };

const taxi: Transfer = {
  transfer_id: 'TR-TAXI',
  type: 'AIRPORT_TAXI',
  name: 'Airport taxi',
  airport: 'NRT',
  city: 'Tokyo',
  area: null,
  from_point: 'NRT',
  to_point: 'Tokyo hotels',
  max_passengers: 4,
  service_from: '06:00',
  service_until: '23:00',
  duration_minutes: 70,
  pricing: 'PER_VEHICLE',
  price: inr(12880),
};
const bus: Transfer = {
  ...taxi,
  transfer_id: 'TR-BUS',
  type: 'AIRPORT_BUS',
  max_passengers: 99,
  pricing: 'PER_PERSON',
  price: inr(1792),
  child_price: inr(896),
};

describe('transferPrice', () => {
  it('charges one vehicle for every 4 travelers or part of 4', () => {
    expect(transferPrice(taxi, { adults: 4, children: 1 })).toBe(2 * 12880);
    expect(transferQuantity(taxi, { adults: 4, children: 1 })).toBe(2);
  });

  it('charges children their own price', () => {
    expect(transferPrice(bus, party)).toBe(2 * 1792 + 896);
    expect(transferQuantity(bus, party)).toBe(3);
  });

  it('charges children the adult price when there is no child price', () => {
    expect(transferPrice({ ...bus, child_price: undefined }, party)).toBe(3 * 1792);
  });

  it('lets children ride free when the child price is 0', () => {
    expect(transferPrice({ ...bus, child_price: inr(0) }, party)).toBe(2 * 1792);
  });
});

describe('attractionPrice', () => {
  const museum = {
    price_per_person: inr(1000),
    child_price: inr(400),
  } as Attraction;

  it('charges children their own price, or the adult price when there is none', () => {
    expect(attractionPrice(museum, party)).toBe(2 * 1000 + 400);
    expect(attractionPrice({ ...museum, child_price: undefined }, party)).toBe(3 * 1000);
  });
});
