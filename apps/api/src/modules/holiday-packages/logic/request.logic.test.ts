import type { HolidayRequest } from '@bh/shared/holiday-package';
import { describe, expect, it } from 'vitest';
import { getCatalog } from '../../catalog/catalog.loader';
import { checkRequest } from './request.logic';

const catalog = getCatalog();
const menon: HolidayRequest = {
  departureAirport: 'BLR',
  country: 'JP',
  startDate: '2027-04-10',
  nights: 6,
  adults: 2,
  childAges: [6],
  budgetInr: 350000,
};

describe('checkRequest', () => {
  it('accepts the Menon request', () => {
    expect(checkRequest(menon, catalog)).toEqual([]);
  });

  it('names a departure city or country that is not in the data', () => {
    expect(checkRequest({ ...menon, departureAirport: 'XYZ', country: 'FR' }, catalog)).toEqual([
      { path: 'departureAirport', message: 'Choose a departure city from the list' },
      { path: 'country', message: 'Choose a country from the list' },
    ]);
  });

  it('takes the night limits from the data', () => {
    expect(checkRequest({ ...menon, nights: 2 }, catalog)).toEqual([
      { path: 'nights', message: 'Choose 3 to 10 nights' },
    ]);
  });

  it('refuses a start before the data begins', () => {
    expect(checkRequest({ ...menon, startDate: '2027-03-31' }, catalog)).toEqual([
      { path: 'startDate', message: 'The holiday can start on 1 Apr 2027 at the earliest' },
    ]);
  });

  it('gives the latest start for the chosen nights when the trip would end too late', () => {
    expect(checkRequest({ ...menon, startDate: '2027-04-18' }, catalog)).toEqual([
      {
        path: 'startDate',
        message: 'Flights and rooms exist until 20 Apr 2027. With 6 nights, start by 14 Apr 2027',
      },
    ]);
  });
});
