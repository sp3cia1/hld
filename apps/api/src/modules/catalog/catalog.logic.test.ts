import { describe, expect, it } from 'vitest';
import { buildCatalog, type CatalogFiles } from './catalog.logic';

const files: CatalogFiles = {
  destinations: {
    departure_cities: [{ airport: 'BLR', city: 'Bengaluru' }],
    countries: [
      {
        code: 'JP',
        name: 'Japan',
        timezone: 'Asia/Tokyo',
        cities: [{ name: 'Tokyo', airports: ['NRT'] }],
        links: [],
      },
    ],
    rules: {
      min_nights: 3,
      max_nights: 10,
      min_nights_per_city: 2,
      data_window: { first_night: '2027-04-01', last_departure: '2027-04-20' },
    },
  },
  airports: [
    { code: 'BLR', name: 'Bengaluru', city: 'Bengaluru', country: 'IN', timezone: 'Asia/Kolkata' },
    {
      code: 'NRT',
      name: 'Narita',
      city: 'Tokyo',
      country: 'JP',
      timezone: 'Asia/Tokyo',
      serves_cities: ['Tokyo'],
    },
  ],
  flights: [],
  hotels: [],
  rooms: [],
  availability: [],
  transfers: [],
  attractions: [],
};

describe('buildCatalog', () => {
  it('indexes airports by the cities they serve', () => {
    const catalog = buildCatalog(files);
    expect(catalog.airportsServingCity.get('Tokyo')?.map((a) => a.code)).toEqual(['NRT']);
  });

  it('refuses a record that points at another record that does not exist', () => {
    const broken: CatalogFiles = {
      ...files,
      rooms: [
        {
          room_id: 'RM-1',
          hotel_id: 'HTL-MISSING',
          room_type: 'TWIN',
          name: 'Twin',
          max_adults: 2,
          max_children: 0,
          price_per_night: { amount: 1000, currency: 'INR' },
          refundable: true,
        },
      ],
    };
    expect(() => buildCatalog(broken)).toThrow(
      'rooms.json: RM-1 belongs to unknown hotel HTL-MISSING',
    );
  });

  it('refuses two records with the same id', () => {
    const duplicated: CatalogFiles = {
      ...files,
      airports: [...files.airports, files.airports[1]!],
    };
    expect(() => buildCatalog(duplicated)).toThrow('airports.json: duplicate id NRT');
  });
});
