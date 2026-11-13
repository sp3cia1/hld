import { describe, expect, it } from 'vitest';
import { getCatalog } from '../../catalog/catalog.loader';
import { MENON_EXAMPLE_TRIP } from './menon-example';
import { summaryOf } from './summary.logic';

const catalog = getCatalog();

describe('summaryOf', () => {
  it('counts both flights, not the airport transfers, and averages the hotel stars over the nights', () => {
    // FL-401 takes 430 minutes and FL-412 600; Ueno Garden Inn has 3 stars for all 6 nights.
    expect(summaryOf(MENON_EXAMPLE_TRIP, catalog)).toEqual({
      travelMinutes: 1030,
      averageStars: 3,
    });
  });

  it('counts a move between cities, and weights each hotel by its nights', () => {
    const tokyo = MENON_EXAMPLE_TRIP.items.find((item) => item.type === 'hotel')!;
    const train = {
      ...MENON_EXAMPLE_TRIP.items[1]!,
      item_id: 'i11',
      catalog_id: 'TR-TYO-OSA-01',
      start: '2027-04-12T10:00',
      end: '2027-04-12T12:30',
    };
    // Tokyo 2 nights at 3 stars, then a 5-star Osaka hotel for 4 nights: (2 × 3 + 4 × 5) ÷ 6 = 4.33.
    const osaka = { ...tokyo, item_id: 'i12', city: 'Osaka', catalog_id: fiveStar('Osaka') };
    const items = [
      ...MENON_EXAMPLE_TRIP.items.filter((item) => item !== tokyo),
      { ...tokyo, end: '2027-04-12' },
      train,
      { ...osaka, start: '2027-04-12', end: '2027-04-16' },
    ];

    expect(summaryOf({ ...MENON_EXAMPLE_TRIP, items }, catalog)).toEqual({
      travelMinutes: 1030 + 150,
      averageStars: 4.33,
    });
  });
});

function fiveStar(city: string): string {
  return [...catalog.hotels.values()].find((hotel) => hotel.city === city && hotel.stars === 5)!
    .hotel_id;
}
