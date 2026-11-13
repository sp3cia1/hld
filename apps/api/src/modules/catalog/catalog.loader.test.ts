import { describe, expect, it } from 'vitest';
import { key } from './catalog.logic';
import { getCatalog } from './catalog.loader';

// Checks the real files against facts from the statement's Menon request (PROBLEM.md, "What the data shows").
describe('getCatalog', () => {
  const catalog = getCatalog();

  it('reads every file', () => {
    expect(catalog.flights.size).toBeGreaterThan(0);
    expect(catalog.roomsLeft.size).toBeGreaterThan(0);
    expect(catalog.destinations.countries.map((c) => c.name)).toContain('Japan');
  });

  it('finds the 4 flights from Bengaluru that land in Japan on 10 Apr 2027', () => {
    const japan = ['NRT', 'HND', 'KIX'];
    const ids = japan
      .flatMap((to) => catalog.flightsByArrival.get(key('BLR', to, '2027-04-10')) ?? [])
      .map((f) => f.flight_id)
      .sort();

    expect(ids).toEqual(['FL-401', 'FL-403', 'FL-405', 'FL-740']);
  });

  it('knows which airports serve a city with no airport of its own', () => {
    expect(catalog.airportsServingCity.get('Kyoto')?.map((a) => a.code)).toEqual(['KIX']);
  });

  it('links each pair of cities to its transfers', () => {
    const ids = catalog.intercityTransfers.get(key('Tokyo', 'Kyoto'))?.map((t) => t.transfer_id);
    expect(ids).toEqual(['TR-TYO-KYO-01']);
  });
});
