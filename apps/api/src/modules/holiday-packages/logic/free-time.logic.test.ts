import { describe, expect, it } from 'vitest';
import { getCatalog } from '../../catalog/catalog.loader';
import { freeTimeIn } from './free-time.logic';
import { MENON_EXAMPLE_TRIP } from './menon-example';

const catalog = getCatalog();
const menon = MENON_EXAMPLE_TRIP;
const [, arrivalTransfer, , firstVisit] = menon.items;

describe('freeTimeIn', () => {
  it('lists what still fits on the arrival afternoon, cheapest first', () => {
    // Menon reaches the Ueno hotel at 13:00 (bus pickup 11:30 + 90 minutes). Their 5 planned visits are left out.
    const free = freeTimeIn(menon, catalog);

    expect(free).toHaveLength(1);
    expect(free[0]).toMatchObject({
      date: '2027-04-10',
      city: 'Tokyo',
      freeFrom: '2027-04-10T13:00',
      stationTaxiInr: null,
    });
    expect(free[0]!.attractions.map((a) => [a.name, a.priceInr])).toEqual([
      ['Odaiba Seaside Park', 0],
      ['Tsukiji Outer Market', 0],
      ['Shinjuku Gyoen', 560],
      ['Tokyo National Museum', 1120],
      ['Tokyo Toy Museum', 1680],
      ['Tokyo Tower', 1736],
      ['Tokyo Skytree', 2884],
      ['teamLab Planets TOKYO', 5096],
      ['Tokyo Disneyland', 13664],
    ]);
  });

  it('puts the free attraction with more room first: Tsukiji closes an hour after the family arrives', () => {
    const [odaiba, tsukiji] = freeTimeIn(menon, catalog)[0]!.attractions;

    expect(odaiba).toMatchObject({ earliestStart: '2027-04-10T13:00', endBy: '2027-04-11T00:00' });
    expect(tsukiji).toMatchObject({
      earliestStart: '2027-04-10T13:00',
      endBy: '2027-04-10T14:00',
      visitMinutes: 60,
    });
  });

  it('lists nothing for a day the traveler already added a visit to', () => {
    const addedVisit = {
      ...firstVisit!,
      item_id: 'i11',
      catalog_id: 'ATT-TYO-015',
      start: '2027-04-10T15:00',
      end: '2027-04-10T16:00',
    };

    expect(freeTimeIn({ ...menon, items: [...menon.items, addedVisit] }, catalog)).toEqual([]);
  });

  it('lists nothing when the traveler reaches the hotel after midnight', () => {
    const latePickup = { ...arrivalTransfer!, start: '2027-04-10T23:30', end: '2027-04-11T01:00' };
    const items = menon.items.map((item) => (item === arrivalTransfer ? latePickup : item));

    expect(freeTimeIn({ ...menon, items }, catalog)).toEqual([]);
  });

  it('on a city-change day, adds the taxi from the station to the time and the price', () => {
    // Only the transfers matter here: Menon with a Shinkansen to Osaka on Monday 12 Apr, leaving at 10:00 and
    // reaching Shin-Osaka at 12:30. The Osaka taxi from the station takes 20 minutes and costs ₹1,232.
    const train = {
      ...arrivalTransfer!,
      item_id: 'i12',
      name: 'Shinkansen Tokyo to Osaka',
      city: 'Osaka',
      catalog_id: 'TR-TYO-OSA-01',
      start: '2027-04-12T10:00',
      end: '2027-04-12T12:30',
      price_inr: 20608,
    };
    const items = [...menon.items.filter((item) => !item.start.startsWith('2027-04-12')), train];

    const changeDay = freeTimeIn({ ...menon, items }, catalog).find((f) => f.date === '2027-04-12');

    expect(changeDay).toMatchObject({
      city: 'Osaka',
      freeFrom: '2027-04-12T12:50',
      stationTaxiInr: 1232,
    });
    expect(changeDay!.attractions.slice(0, 4).map((a) => a.name)).toEqual([
      'Dotonbori',
      'Shinsekai',
      'Kuromon Ichiba Market',
      'Sumiyoshi Taisha',
    ]);
  });
});
