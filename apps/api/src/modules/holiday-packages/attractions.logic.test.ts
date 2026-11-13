import { describe, expect, it } from 'vitest';
import { assignCheapest, type Option } from './attractions.logic';

const options = (...list: [string, number][]): Option[] => list.map(([id, cost]) => ({ id, cost }));

describe('assignCheapest', () => {
  it('moves an earlier day when a later day has no other option', () => {
    const result = assignCheapest(
      ['mon', 'tue'],
      new Map([
        ['mon', options(['a', 0], ['b', 0])],
        ['tue', options(['a', 0])],
      ]),
    );
    expect(result).toEqual(
      new Map([
        ['mon', 'b'],
        ['tue', 'a'],
      ]),
    );
  });

  it('finds the cheapest total, not the cheapest first pick', () => {
    // Greedy gives day 1 the free "a", so day 2 pays 500 for "c". The cheapest whole costs 100.
    const result = assignCheapest(
      ['d1', 'd2'],
      new Map([
        ['d1', options(['a', 0], ['b', 100])],
        ['d2', options(['a', 0], ['c', 500])],
      ]),
    );
    expect(result).toEqual(
      new Map([
        ['d1', 'b'],
        ['d2', 'a'],
      ]),
    );
  });

  it('returns null when the days cannot all get a different option', () => {
    const result = assignCheapest(
      ['d1', 'd2', 'd3'],
      new Map([
        ['d1', options(['a', 0])],
        ['d2', options(['a', 0])],
        ['d3', options(['b', 0], ['c', 0])],
      ]),
    );
    expect(result).toBeNull();
  });

  it('returns null when a day has no option at all', () => {
    expect(assignCheapest(['d1'], new Map())).toBeNull();
  });

  it('takes the option listed first when costs are equal', () => {
    expect(assignCheapest(['d1'], new Map([['d1', options(['a', 5], ['b', 5])]]))).toEqual(
      new Map([['d1', 'a']]),
    );
  });
});
