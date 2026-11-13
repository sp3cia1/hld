import type { HolidayRequest } from '@bh/shared/holiday-package';
import { describe, expect, it } from 'vitest';
import { getCatalog } from '../../catalog/catalog.loader';
import { buildPackage } from './builder.logic';
import { MENON_EXAMPLE_TRIP } from './menon-example';

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

describe('buildPackage', () => {
  it('builds the Menon package from the statement', () => {
    expect(buildPackage(menon, catalog)).toEqual({ status: 'OK', trip: MENON_EXAMPLE_TRIP });
  });

  it('returns the cheapest package, labelled, when none fits the budget', () => {
    expect(buildPackage({ ...menon, budgetInr: 1000 }, catalog)).toEqual({
      status: 'OVER_BUDGET',
      trip: { ...MENON_EXAMPLE_TRIP, budget_inr: 1000 },
    });
  });

  it('counts a total equal to the budget as within budget', () => {
    const total = MENON_EXAMPLE_TRIP.total_inr;
    expect(buildPackage({ ...menon, budgetInr: total }, catalog).status).toBe('OK');
  });

  it.each([
    [
      'no flight lands that day',
      { ...menon, departureAirport: 'MAA' },
      'NO_ARRIVAL_FLIGHT',
      'No flight from Chennai lands in Japan on 10 Apr 2027.',
    ],
    [
      'flights land but have too few seats',
      {
        ...menon,
        departureAirport: 'DEL',
        startDate: '2027-04-01',
        nights: 3,
        adults: 5,
        childAges: [],
      },
      'NO_ARRIVAL_SEATS',
      'No flight from Delhi landing in Japan on 1 Apr 2027 has 5 seats left.',
    ],
    [
      'no flight goes back on the last day',
      { ...menon, departureAirport: 'BOM', startDate: '2027-04-01', nights: 3 },
      'NO_RETURN_FLIGHT',
      'No flight back to Mumbai leaves Japan on 4 Apr 2027.',
    ],
    [
      'the arrival and return airports serve no city in common',
      { ...menon, departureAirport: 'BOM', startDate: '2027-04-02', nights: 3 },
      'NO_COMMON_CITY',
      'On 2 Apr 2027 flights land only at NRT, and on 5 Apr 2027 flights back leave only from KIX. No city is served by both.',
    ],
  ])('explains why no package is possible: %s', (_, request, code, message) => {
    expect(buildPackage(request, catalog)).toEqual({
      status: 'NO_PACKAGE',
      reason: { code, message },
    });
  });
});
