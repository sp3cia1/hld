import type { QuickRequestFields } from '@bh/shared/quick-request';
import { describe, expect, it } from 'vitest';
import { getCatalog } from '../catalog/catalog.loader';
import { readRequest, vocabularyFrom } from './quick-request.logic';

const catalog = getCatalog();
const vocabulary = vocabularyFrom(catalog.destinations, [...catalog.attractions.values()]);
const read = (text: string) => readRequest(text, vocabulary);

const menon: QuickRequestFields = {
  departureAirport: 'BLR',
  country: 'JP',
  startDate: '2027-04-10',
  nights: 6,
  adults: 2,
  childAges: [6],
  budgetInr: 350000,
};

describe('readRequest', () => {
  it('reads the Menon request written in plain words', () => {
    const result = read(
      'Family trip from Bangalore to Japan, 10 to 16 April, 2 adults and a 6-year-old, budget 3.5 lakh',
    );

    expect(result.fields).toEqual(menon);
    expect(result.childrenWithoutAges).toBe(0);
    // The one thing it read without the text saying it: the year, the only one the data has.
    expect(result.notes).toEqual([
      'A date without a year is read in 2027, the only year we have trips for.',
    ]);
  });

  it.each<[string, QuickRequestFields]>([
    ['BLR to NRT on 2027-04-10 for 6 nights, 2 adults, 1 child aged 6, INR 3,50,000', menon],
    [
      '2 kids 4 and 9, 2 adults, 6 nights from 10th of April, Japan from Bengaluru, ₹3.5 lakhs',
      { ...menon, childAges: [4, 9] },
    ],
    [
      'Me and my wife from Mumbai to Dubai, 5 nights from 8 April, budget ₹2L',
      {
        departureAirport: 'BOM',
        country: 'AE',
        startDate: '2027-04-08',
        nights: 5,
        adults: 2,
        budgetInr: 200000,
      },
    ],
    [
      // An attraction names its country, through the city it is in.
      'Solo trip to see Fushimi Inari, flying out of Chennai on April 3rd, 4 nights, 1.2 lakh',
      {
        departureAirport: 'MAA',
        country: 'JP',
        startDate: '2027-04-03',
        nights: 4,
        adults: 1,
        budgetInr: 120000,
      },
    ],
    [
      // A family of 4 with two children is two adults.
      'Family of 4 from Delhi to UAE with kids aged 4 and 9, 02/04/2027, 7 nights, 3,00,000',
      {
        departureAirport: 'DEL',
        country: 'AE',
        startDate: '2027-04-02',
        nights: 7,
        adults: 2,
        childAges: [4, 9],
        budgetInr: 300000,
      },
    ],
    [
      'two adults, three nights, april 12th, from new delhi, 150000 rupees, japan',
      {
        departureAirport: 'DEL',
        country: 'JP',
        startDate: '2027-04-12',
        nights: 3,
        adults: 2,
        budgetInr: 150000,
      },
    ],
    [
      'couple, no kids, Osaka, 350k',
      { country: 'JP', adults: 2, childAges: [], budgetInr: 350000 },
    ],
    [
      'my son (6) and I from BOM to DXB, Apr 5 - 11, 2 lakh',
      {
        departureAirport: 'BOM',
        country: 'AE',
        startDate: '2027-04-05',
        nights: 6,
        childAges: [6],
        budgetInr: 200000,
      },
    ],
  ])('reads %j', (text, fields) => {
    expect(read(text).fields).toEqual(fields);
  });

  it.each<[string, keyof QuickRequestFields, string]>([
    ['a week in Japan', 'nights', '“a week”: is that 6 or 7 nights?'],
    ['5 days in Tokyo', 'nights', '“5 days”: is that 4 or 5 nights?'],
    [
      '10 to 16 April for 5 nights',
      'nights',
      'Your dates make 6 nights, but your text also says 5 nights',
    ],
    ['Japan in April', 'startDate', 'Which day in April does the holiday start?'],
    ['starting 31 April', 'startDate', "31 April isn't a date"],
    ['budget 3-4 lakh', 'budgetInr', '“3-4 lakh” is a range'],
    ['budget 3.5', 'budgetInr', '“budget 3.5” is too small for a budget in rupees'],
    [
      'budget 3 lakh, or maybe 4 lakh',
      'budgetInr',
      'more than one budget (₹3,00,000 and ₹4,00,000)',
    ],
    ['from Delhi or Mumbai', 'departureAirport', 'more than one departure city (Delhi and Mumbai)'],
    ['from Kolkata', 'departureAirport', "Kolkata isn't one of our departure cities"],
    [
      'to Bali',
      'country',
      "Bali isn't one of our destinations: choose Japan or United Arab Emirates",
    ],
    ['Tokyo and Dubai', 'country', 'more than one country (Japan and United Arab Emirates)'],
    [
      'family of 4 to Japan',
      'adults',
      '“family of 4”: how many are adults, and how many are children?',
    ],
    ['2 adults or maybe solo', 'adults', 'more than one number of adults (2 and 1)'],
    ['with kids to Japan', 'childAges', 'Travelling with children?'],
  ])('leaves out what %j does not settle, and says so', (text, field, note) => {
    const result = read(text);

    expect(result.fields[field]).toBeUndefined();
    expect(result.notes.join(' ')).toContain(note);
  });

  it('counts children it has no age for, so the form can ask for each age', () => {
    expect(read('2 adults with 2 kids')).toMatchObject({
      fields: { adults: 2, childAges: [] },
      childrenWithoutAges: 2,
      notes: ['Add the age of each child below.'],
    });
    expect(read('3 kids aged 4 and 9')).toMatchObject({
      fields: { childAges: [4, 9] },
      childrenWithoutAges: 1,
      notes: ['Add the age of the other child below.'],
    });
  });

  it('reads 10/04 day first, and says so', () => {
    const result = read('honeymoon in Kyoto from 12/04 for 6 nights');

    expect(result.fields).toMatchObject({ startDate: '2027-04-12', nights: 6, adults: 2 });
    expect(result.notes).toContain('A date like 10/04 is read day first: 12 April.');
  });

  it('fills a date outside the data as written: the form says why on Build', () => {
    expect(read('from 10 May').fields.startDate).toBe('2027-05-10');
  });

  it('fills nothing from text that is not a holiday', () => {
    expect(read('asdf qwerty 42')).toEqual({ fields: {}, childrenWithoutAges: 0, notes: [] });
  });
});
