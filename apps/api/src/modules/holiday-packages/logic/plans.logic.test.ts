import { describe, expect, it } from 'vitest';
import { getCatalog } from '../../catalog/catalog.loader';
import { key } from '../../catalog/catalog.logic';
import { MENON_EXAMPLE_TRIP } from './menon-example';
import { cityPlans, planOf, samePlan, type CityPlan } from './plans.logic';

const catalog = getCatalog();
const japan = ['Tokyo', 'Kyoto', 'Osaka'];
const linked = (from: string, to: string) => catalog.intercityTransfers.has(key(from, to));
const names = (plan: CityPlan) => plan.map((stop) => `${stop.city} ${stop.nights}`).join(' > ');

describe('cityPlans', () => {
  it('lists the 27 plans for 6 nights in Japan: 3 with one city, 18 with two, 6 with three', () => {
    const plans = cityPlans(japan, 6, 2, linked);

    expect(plans).toHaveLength(27);
    expect(plans.filter((plan) => plan.length === 1)).toHaveLength(3);
    expect(plans.filter((plan) => plan.length === 2)).toHaveLength(18);
    expect(plans.filter((plan) => plan.length === 3)).toHaveLength(6);
    expect(plans.map(names)).toContain('Tokyo 6');
    expect(plans.map(names)).toContain('Tokyo 2 > Kyoto 2 > Osaka 2');
  });

  it('keeps every plan to the rules for every trip length', () => {
    for (let nights = 3; nights <= 10; nights++) {
      for (const plan of cityPlans(japan, nights, 2, linked)) {
        const cities = plan.map((stop) => stop.city);
        expect(new Set(cities).size).toBe(cities.length);
        expect(plan.every((stop) => stop.nights >= 2)).toBe(true);
        expect(plan.reduce((sum, stop) => sum + stop.nights, 0)).toBe(nights);
        expect(cities.slice(1).every((city, i) => linked(cities[i]!, city))).toBe(true);
      }
    }
  });

  it('has only one-city plans when the trip is too short for two', () => {
    expect(cityPlans(japan, 3, 2, linked).map(names)).toEqual(['Tokyo 3', 'Kyoto 3', 'Osaka 3']);
  });

  it('never joins two cities that have no link', () => {
    expect(cityPlans(japan, 6, 2, () => false).map(names)).toEqual([
      'Tokyo 6',
      'Kyoto 6',
      'Osaka 6',
    ]);
  });
});

describe('planOf and samePlan', () => {
  it('reads the city plan from the hotels', () => {
    expect(planOf(MENON_EXAMPLE_TRIP)).toEqual([{ city: 'Tokyo', nights: 6 }]);
  });

  it('compares cities, order and nights', () => {
    const plan = [
      { city: 'Tokyo', nights: 2 },
      { city: 'Osaka', nights: 4 },
    ];
    expect(samePlan(plan, [...plan])).toBe(true);
    expect(samePlan(plan, [...plan].reverse())).toBe(false);
    expect(samePlan(plan, [{ city: 'Tokyo', nights: 6 }])).toBe(false);
  });
});
