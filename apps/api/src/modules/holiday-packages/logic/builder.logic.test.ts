import type { HolidayRequest } from '@bh/shared/holiday-package';
import { describe, expect, it } from 'vitest';
import { getCatalog } from '../../catalog/catalog.loader';
import { buildPackage, planChoices } from './builder.logic';
import { planOf } from './plans.logic';
import { MENON_EXAMPLE_TRIP } from './menon-example';
import { summaryOf } from './summary.logic';
import { validateTrip } from './validator.logic';

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
    expect(buildPackage(menon, catalog)).toMatchObject({ status: 'OK', trip: MENON_EXAMPLE_TRIP });
  });

  it('returns only the cheapest package, labelled, when none fits the budget', () => {
    const trip = { ...MENON_EXAMPLE_TRIP, budget_inr: 1000 };
    expect(buildPackage({ ...menon, budgetInr: 1000 }, catalog)).toEqual({
      status: 'OVER_BUDGET',
      trip,
      options: [{ labels: ['CHEAPEST'], trip }],
    });
  });

  it('counts a total equal to the budget as within budget', () => {
    const total = MENON_EXAMPLE_TRIP.total_inr;
    expect(buildPackage({ ...menon, budgetInr: total }, catalog).status).toBe('OK');
  });

  it('visits two cities when the flights land and leave at airports with no city in common', () => {
    // Delhi, 1 Apr, 5 nights: the only flight in lands at HND (Tokyo), the only flight home leaves from KIX (Osaka).
    const trip = built({ ...menon, departureAirport: 'DEL', startDate: '2027-04-01', nights: 5 });

    expect(trip.total_inr).toBe(283060);
    expect(stays(trip)).toEqual([
      ['Tokyo', '2027-04-01', '2027-04-03'],
      ['Osaka', '2027-04-03', '2027-04-06'],
    ]);
    expect(trip.items.find((item) => item.catalog_id === 'TR-TYO-OSA-01')).toMatchObject({
      city: 'Osaka',
      start: '2027-04-03T10:00',
      end: '2027-04-03T12:30',
      price_inr: 20608,
    });
  });

  it('picks two cities when they cost less than any one city', () => {
    // Bengaluru, 5 Apr, 4 nights: Tokyo then Osaka is ₹4,872 less than the cheapest single city.
    const trip = built({ ...menon, startDate: '2027-04-05', nights: 4 });

    expect(trip.total_inr).toBe(234584);
    expect(stays(trip).map(([city]) => city)).toEqual(['Tokyo', 'Osaka']);
  });

  it('on equal totals, reaches the first hotel sooner', () => {
    // Bengaluru, 7 Apr, 9 nights: Osaka 5 then Kyoto 4, and Kyoto 4 then Osaka 5, both cost ₹2,57,110. Osaka first
    // reaches its hotel at 12:20, Kyoto first at 13:00.
    const trip = built({ ...menon, startDate: '2027-04-07', nights: 9 });

    expect(trip.total_inr).toBe(257110);
    expect(stays(trip).map(([city]) => city)).toEqual(['Osaka', 'Kyoto']);
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
      'On 2 Apr 2027 flights land only at NRT, and on 5 Apr 2027 flights back leave only from KIX. No city is served by both, and 3 nights is too short for two cities: each needs at least 2.',
    ],
  ])('explains why no package is possible: %s', (_, request, code, message) => {
    expect(buildPackage(request, catalog)).toEqual({
      status: 'NO_PACKAGE',
      reason: { code, message },
    });
  });
});

function built(request: HolidayRequest) {
  const outcome = buildPackage(request, catalog);
  if (outcome.status === 'NO_PACKAGE') throw new Error(outcome.reason.message);
  return outcome.trip;
}

/** Each hotel stay as [city, check-in, check-out], in travel order. */
function stays(trip: ReturnType<typeof built>) {
  return trip.items
    .filter((item) => item.type === 'hotel')
    .map((item) => [item.city, item.start, item.end]);
}

describe('the three packages (G4)', () => {
  const uae: HolidayRequest = {
    ...menon,
    country: 'AE',
    startDate: '2027-04-06',
    budgetInr: 200000,
  };

  it('offers Menon the cheapest, which is also the fastest, and a 5-star package within budget', () => {
    const outcome = buildPackage(menon, catalog);
    if (outcome.status === 'NO_PACKAGE') throw new Error(outcome.reason.message);

    expect(outcome.options.map((option) => option.labels)).toEqual([
      ['CHEAPEST', 'FASTEST'],
      ['BEST_RATED'],
    ]);
    const [cheapest, bestRated] = outcome.options;
    expect(cheapest!.trip).toEqual(MENON_EXAMPLE_TRIP);
    expect(bestRated!.trip.total_inr).toBe(316764);
    expect(summaryOf(bestRated!.trip, catalog).averageStars).toBe(5);
  });

  it('offers three packages when each label wins with a different one', () => {
    // Bengaluru to the UAE, 6 Apr, 6 nights, ₹2,00,000: the cheapest visits two cities, the fastest stays in Abu Dhabi
    // with no move between cities, and the best rated pays for 4-star hotels.
    const outcome = buildPackage(uae, catalog);
    if (outcome.status === 'NO_PACKAGE') throw new Error(outcome.reason.message);

    expect(outcome.options.map((option) => [option.labels, option.trip.total_inr])).toEqual([
      [['CHEAPEST'], 159728],
      [['FASTEST'], 161926],
      [['BEST_RATED'], 192154],
    ]);
    const [cheapest, fastest, bestRated] = outcome.options.map((option) =>
      summaryOf(option.trip, catalog),
    );
    expect(fastest!.travelMinutes).toBe(495);
    expect(fastest!.travelMinutes).toBeLessThan(cheapest!.travelMinutes);
    expect(bestRated!.averageStars).toBe(4);
    expect(bestRated!.averageStars).toBeGreaterThan(cheapest!.averageStars);
  });

  it('keeps every package offered within budget, with every rule true', () => {
    const requests: HolidayRequest[] = [
      menon,
      uae,
      { ...menon, departureAirport: 'DEL', startDate: '2027-04-01', nights: 5 },
      { ...menon, startDate: '2027-04-05', nights: 10, budgetInr: 600000 },
    ];
    for (const request of requests) {
      const outcome = buildPackage(request, catalog);
      if (outcome.status === 'NO_PACKAGE') throw new Error(outcome.reason.message);
      for (const option of outcome.options) {
        expect(option.trip.total_inr).toBeLessThanOrEqual(request.budgetInr);
        expect(validateTrip(option.trip, catalog)).toEqual([]);
      }
    }
  });
});

describe('changing the cities (G3)', () => {
  const tokyoOsaka = [
    { city: 'Tokyo', nights: 2 },
    { city: 'Osaka', nights: 4 },
  ];

  it('lists every valid plan for Menon with its cheapest total', () => {
    const choices = planChoices(menon, catalog);

    expect(choices).toHaveLength(27);
    expect(choices.every((choice) => choice.reason === null)).toBe(true);
    expect(
      choices.find((choice) => choice.plan.length === 1 && choice.plan[0]!.city === 'Tokyo'),
    ).toMatchObject({ totalInr: 219324 });
    expect(
      choices.find((choice) => JSON.stringify(choice.plan) === JSON.stringify(tokyoOsaka)),
    ).toMatchObject({
      totalInr: 230440,
    });
  });

  it("says why a plan can't be built, about its own cities", () => {
    // Delhi, 1 Apr, 5 nights: the only flight in lands at HND, so no plan can start in Osaka.
    const choices = planChoices(
      { ...menon, departureAirport: 'DEL', startDate: '2027-04-01', nights: 5 },
      catalog,
    );

    expect(choices.find((choice) => choice.plan[0]!.city === 'Osaka')?.reason).toBe(
      'No flight from Delhi with 3 seats lands near Osaka on 1 Apr 2027.',
    );
  });

  it('builds the three packages again for the chosen plan only', () => {
    const outcome = buildPackage(menon, catalog, tokyoOsaka);
    if (outcome.status === 'NO_PACKAGE') throw new Error(outcome.reason.message);

    expect(outcome.trip.total_inr).toBe(230440);
    for (const option of outcome.options) {
      expect(planOf(option.trip)).toEqual(tokyoOsaka);
      expect(validateTrip(option.trip, catalog)).toEqual([]);
    }
  });
});
