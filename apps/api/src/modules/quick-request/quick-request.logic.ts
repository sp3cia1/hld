import type { QuickRequestFields, QuickRequestResult } from '@bh/shared/quick-request';
import type { Attraction, Destinations } from '../catalog/catalog.schemas';

// Quick request (S1): a holiday described in plain words, read with rules into the request form's fields. No AI.
// The reader never guesses. A field the text doesn't give, gives twice with different values, or gives in words that
// could mean two things ("a week", "5 days", "3-4 lakh") is left out, with a note that says what to check. The form
// then checks every value against the data on Build, exactly as it does for typed ones.
//
// Numbers are read in a fixed order (budget, dates, nights, children, adults), and each one is used once: once
// "3.5 lakh" is the budget, its 3 can't also be a number of nights.

/** The words the reader knows. All of them come from the catalog, plus a few other names for the same places. */
export type Vocabulary = {
  /** Place name (normalized) -> departure airport: the city names, and their other names. */
  departures: Map<string, string>;
  /** Place name (normalized) -> country code: the country's names, its cities, and the attractions in them. */
  destinations: Map<string, string>;
  /** Codes as written, in capitals: BLR -> BLR. */
  departureCodes: Map<string, string>;
  /** Codes as written, in capitals: JP -> JP, NRT -> JP. */
  destinationCodes: Map<string, string>;
  /** Departure airport -> city name, in the order of destinations.json. */
  departureCities: Map<string, string>;
  /** Country code -> name, in the order of destinations.json. */
  countryNames: Map<string, string>;
  /** The year of the data window. Every holiday is in it, so a date without a year is read in it. */
  year: number;
};

/** Names people use that the data doesn't have, for places it does. Everything else the reader knows is data. */
const OTHER_NAMES: Record<string, string> = {
  bangalore: 'Bengaluru',
  bombay: 'Mumbai',
  madras: 'Chennai',
  'new delhi': 'Delhi',
  uae: 'United Arab Emirates',
  'u a e': 'United Arab Emirates',
  emirates: 'United Arab Emirates',
};

/** Builds the vocabulary from destinations.json and attractions.json. */
export function vocabularyFrom(destinations: Destinations, attractions: Attraction[]): Vocabulary {
  const departures = new Map<string, string>();
  const departureCodes = new Map<string, string>();
  const departureCities = new Map<string, string>();
  for (const { airport, city } of destinations.departure_cities) {
    departures.set(normalize(city), airport);
    departures.set(airport.toLowerCase(), airport);
    departureCodes.set(airport, airport);
    departureCities.set(airport, city);
  }

  const destinationsByName = new Map<string, string>();
  const destinationCodes = new Map<string, string>();
  const countryNames = new Map<string, string>();
  const countryOfCity = new Map<string, string>();
  for (const country of destinations.countries) {
    destinationsByName.set(normalize(country.name), country.code);
    destinationCodes.set(country.code, country.code);
    countryNames.set(country.code, country.name);
    for (const city of country.cities) {
      destinationsByName.set(normalize(city.name), country.code);
      countryOfCity.set(city.name, country.code);
      for (const airport of city.airports) {
        destinationCodes.set(airport, country.code);
        destinationsByName.set(airport.toLowerCase(), country.code);
      }
    }
  }
  // An attraction names its country through its city. One in a city the trips don't stay in is left out.
  for (const attraction of attractions) {
    const code = countryOfCity.get(attraction.city);
    if (!code) continue;
    for (const name of [attraction.name, ...(attraction.aliases ?? [])]) {
      destinationsByName.set(normalize(name), code);
    }
  }

  for (const [other, name] of Object.entries(OTHER_NAMES)) {
    const airport = destinations.departure_cities.find((c) => c.city === name)?.airport;
    if (airport) departures.set(other, airport);
    const country = destinations.countries.find((c) => c.name === name)?.code;
    if (country) destinationsByName.set(other, country);
  }

  return {
    departures,
    destinations: destinationsByName,
    departureCodes,
    destinationCodes,
    departureCities,
    countryNames,
    year: Number(destinations.rules.data_window.first_night.slice(0, 4)),
  };
}

/** Reads a holiday described in plain words into the request form's fields. */
export function readRequest(text: string, vocabulary: Vocabulary): QuickRequestResult {
  const scanner = new Scanner(text.toLowerCase());
  // Order matters: each reader uses up the words it reads (see the top of the file).
  const budget = readBudget(scanner);
  const dates = readDates(scanner, vocabulary.year);
  const nights = readNights(scanner);
  const children = readChildren(scanner);
  const adults = readAdults(scanner, children);
  const from = readPlace(text, 'from', vocabulary.departures, vocabulary.departureCodes);
  const to = readPlace(text, 'to', vocabulary.destinations, vocabulary.destinationCodes);

  const fields: QuickRequestFields = {};
  const notes: string[] = [];

  // From
  if (from.found.length === 1) fields.departureAirport = from.found[0];
  else if (from.found.length > 1) {
    const cities = from.found.map((airport) => vocabulary.departureCities.get(airport) ?? airport);
    notes.push(`You named more than one departure city (${list(cities)}): choose From below.`);
  } else if (from.unknown) {
    const cities = [...vocabulary.departureCities.values()];
    notes.push(`${from.unknown} isn't one of our departure cities: choose ${list(cities, 'or')}.`);
  }

  // To
  if (to.found.length === 1) fields.country = to.found[0];
  else if (to.found.length > 1) {
    const names = to.found.map((code) => vocabulary.countryNames.get(code) ?? code);
    notes.push(`You named places in more than one country (${list(names)}): choose To below.`);
  } else if (to.unknown) {
    const names = [...vocabulary.countryNames.values()];
    notes.push(`${to.unknown} isn't one of our destinations: choose ${list(names, 'or')}.`);
  }

  // First day, and the nights a date range gives
  notes.push(...dates.notes);
  let rangeNights: number | undefined;
  if (dates.dates.length === 1) fields.startDate = dates.dates[0];
  else if (dates.dates.length === 2) {
    const [first, last] = [...dates.dates].sort();
    fields.startDate = first;
    rangeNights = daysBetween(first!, last!);
  } else if (dates.dates.length > 2) {
    notes.push('Your text has more than two dates: choose the first day below.');
  }
  if (fields.startDate && dates.yearAdded) {
    notes.push(
      `A date without a year is read in ${vocabulary.year}, the only year we have trips for.`,
    );
  }
  if (fields.startDate && dates.dayFirst) {
    notes.push(`A date like 10/04 is read day first: ${dayMonth(fields.startDate)}.`);
  }

  // Nights
  if (rangeNights !== undefined) {
    const other = nights.values.find((n) => n !== rangeNights);
    if (other === undefined) fields.nights = rangeNights;
    else {
      notes.push(
        `Your dates make ${count(rangeNights, 'night')}, but your text also says ${count(other, 'night')}: set Nights below.`,
      );
    }
  } else if (nights.values.length === 1) fields.nights = nights.values[0];
  else if (nights.values.length > 1) {
    notes.push(
      `Your text gives more than one number of nights (${list(nights.values.map(String))}): set Nights below.`,
    );
  } else notes.push(...nights.questions);

  // Adults
  notes.push(...adults.notes);
  if (adults.value !== undefined) fields.adults = adults.value;

  // Children
  notes.push(...children.notes);
  if (children.ages !== undefined) fields.childAges = children.ages;

  // Budget
  notes.push(...budget.notes);
  if (budget.value !== undefined) fields.budgetInr = budget.value;

  return { fields, childrenWithoutAges: children.withoutAges, notes };
}

// ---------------------------------------------------------------- places

/**
 * The places the text names, from one list. A name that isn't in the data comes back as `unknown`, but only when it
 * is written as a name (a capital letter) right after `from` or `to`: "from Kolkata", "to Bali".
 */
function readPlace(
  text: string,
  word: 'from' | 'to',
  names: Map<string, string>,
  codes: Map<string, string>,
): { found: string[]; unknown?: string } {
  const found = new Set<string>();
  const padded = ` ${normalize(text)} `;
  for (const [name, target] of names) {
    if (padded.includes(` ${name} `)) found.add(target);
  }
  for (const [code] of text.matchAll(/\b[A-Z]{2,3}\b/g)) {
    const target = codes.get(code);
    if (target) found.add(target);
  }
  if (found.size > 0) return { found: [...found] };

  const lead = word === 'from' ? '[Ff]rom' : '[Tt]o';
  const pattern = new RegExp(
    `(?<![\\p{L}])${lead}\\s+(\\p{Lu}\\p{L}+(?:\\s+\\p{Lu}\\p{L}+)?)`,
    'gu',
  );
  for (const match of text.matchAll(pattern)) {
    const name = match[1]!;
    const first = normalize(name).split(' ')[0]!;
    if (MONTH_NUMBERS[first] === undefined && !WEEKDAYS.has(first))
      return { found: [], unknown: name };
  }
  return { found: [] };
}

// ---------------------------------------------------------------- budget

const MONEY = '(?:₹|rs\\.?|inr)';
const AMOUNT = '(\\d{1,3}(?:,\\d{2,3})+|\\d+(?:\\.\\d+)?)';
const UNIT = '(lakhs?|lacs?|l|k|thousands?|crores?|cr)';
const UNIT_VALUES: Record<string, number> = {
  lakh: 100_000,
  lakhs: 100_000,
  lac: 100_000,
  lacs: 100_000,
  l: 100_000,
  k: 1_000,
  thousand: 1_000,
  thousands: 1_000,
  crore: 10_000_000,
  crores: 10_000_000,
  cr: 10_000_000,
};

/** The smallest amount read as a budget. "Budget 3.5" says something, but not in rupees. */
const SMALLEST_BUDGET = 1_000;

function readBudget(scanner: Scanner): { value?: number; notes: string[] } {
  const notes: string[] = [];
  const values: number[] = [];
  const small: string[] = [];
  const ranges = scanner.take(
    new RegExp(
      `${MONEY}?\\s*${AMOUNT}\\s*(?:-|–|to)\\s*${MONEY}?\\s*${AMOUNT}\\s*${UNIT}(?![a-z])`,
      'g',
    ),
  );
  for (const match of ranges)
    notes.push(`“${match[0].trim()}” is a range: enter one budget below.`);
  // 3.5 lakh, ₹3.5L, 350k
  for (const match of scanner.take(new RegExp(`${MONEY}?\\s*${AMOUNT}\\s*${UNIT}(?![a-z])`, 'g'))) {
    values.push(Math.round(amountOf(match[1]!) * UNIT_VALUES[match[2]!]!));
  }
  // ₹3,50,000, Rs 350000, 350000 rupees
  const plain = (match: RegExpExecArray) => {
    const amount = amountOf(match[1]!);
    if (amount < SMALLEST_BUDGET) small.push(match[0].trim());
    else values.push(Math.round(amount));
  };
  scanner.take(new RegExp(`${MONEY}\\s*${AMOUNT}`, 'g')).forEach(plain);
  scanner.take(new RegExp(`${AMOUNT}\\s*(?:rupees|rs|inr)(?![a-z])`, 'g')).forEach(plain);
  // budget 350000, budget of 3.5
  scanner.take(/budget[^\d₹]{0,25}?(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)/g).forEach(plain);
  // A number too big to be anything else: 3,50,000 or 350000.
  for (const match of scanner.take(/(?<![\d.,])(\d{1,3}(?:,\d{2,3})+|\d{5,})(?![\d.,])/g)) {
    values.push(amountOf(match[1]!));
  }

  for (const written of small) {
    notes.push(
      `“${written}” is too small for a budget in rupees: write it like 3.5 lakh or 3,50,000.`,
    );
  }
  const amounts = [...new Set(values)];
  if (ranges.length > 0 || small.length > 0) return { notes };
  if (amounts.length > 1) {
    notes.push(
      `Your text has more than one budget (${list(amounts.map(rupees))}): enter one below.`,
    );
    return { notes };
  }
  return { value: amounts[0], notes };
}

function amountOf(digits: string): number {
  return Number(digits.replaceAll(',', ''));
}

// ---------------------------------------------------------------- dates

const MONTH =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
// prettier-ignore
const MONTH_NUMBERS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11,
  november: 11, dec: 12, december: 12,
};
// prettier-ignore
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November',
  'December',
];
const WEEKDAYS = new Set([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);
const DAY = '(\\d{1,2})(?:st|nd|rd|th)?';
const UNTIL = '\\s*(?:-|–|to|till|until)\\s*';
const YEAR = '(?:,?\\s*(\\d{4})(?!\\d))?';
/** After a number: words that make it a count, not a day of the month. */
const NOT_A_DAY =
  '(?!\\s*(?:nights?|days?|weeks?|adults?|kids?|child|children|people|persons|years?|yrs?))';

type DateReading = {
  /** The dates the text gives, `YYYY-MM-DD`, each once, in the order written. */
  dates: string[];
  /** A date was written without a year. */
  yearAdded: boolean;
  /** A date was written with numbers only (10/04), so it was read day first. */
  dayFirst: boolean;
  notes: string[];
};

function readDates(scanner: Scanner, year: number): DateReading {
  const reading: DateReading = { dates: [], yearAdded: false, dayFirst: false, notes: [] };
  const add = (day: string, month: number, written?: string) => {
    if (!written) reading.yearAdded = true;
    const y = written ? (written.length === 2 ? 2000 + Number(written) : Number(written)) : year;
    const date = isoDate(y, month, Number(day));
    if (!date)
      reading.notes.push(
        `${Number(day)} ${MONTH_NAMES[month - 1]} isn't a date: choose the first day below.`,
      );
    else if (!reading.dates.includes(date)) reading.dates.push(date);
  };

  // 10 to 16 April, 10th-16th of April 2027
  for (const m of scanner.take(
    new RegExp(`${DAY}${UNTIL}${DAY}\\s+(?:of\\s+)?${MONTH}(?![a-z])${YEAR}`, 'g'),
  )) {
    add(m[1]!, MONTH_NUMBERS[m[3]!]!, m[4]);
    add(m[2]!, MONTH_NUMBERS[m[3]!]!, m[4]);
  }
  // April 10 to 16
  for (const m of scanner.take(
    new RegExp(`${MONTH}\\.?\\s+${DAY}${UNTIL}${DAY}(?!\\d)${NOT_A_DAY}${YEAR}`, 'g'),
  )) {
    add(m[2]!, MONTH_NUMBERS[m[1]!]!, m[4]);
    add(m[3]!, MONTH_NUMBERS[m[1]!]!, m[4]);
  }
  // 2027-04-10
  for (const m of scanner.take(/(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/g)) {
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) add(m[3]!, month, m[1]);
  }
  // 10/04/2027, 10/04: day first, as dates are written in India.
  for (const m of scanner.take(/(?<![\d.])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/])/g)) {
    const month = Number(m[2]);
    if (month < 1 || month > 12) continue;
    reading.dayFirst = true;
    add(m[1]!, month, m[3]);
  }
  for (const m of scanner.take(/(?<![\d.-])(\d{1,2})-(\d{1,2})-(\d{4})(?![\d-])/g)) {
    const month = Number(m[2]);
    if (month < 1 || month > 12) continue;
    reading.dayFirst = true;
    add(m[1]!, month, m[3]);
  }
  // 10 April, 10th of April 2027
  for (const m of scanner.take(
    new RegExp(`(?<![\\d.,])${DAY}\\s+(?:of\\s+)?${MONTH}(?![a-z])\\.?${YEAR}`, 'g'),
  )) {
    add(m[1]!, MONTH_NUMBERS[m[2]!]!, m[3]);
  }
  // April 10, Apr 10th, 2027
  for (const m of scanner.take(
    new RegExp(`${MONTH}\\.?\\s+${DAY}(?!\\d)${NOT_A_DAY}${YEAR}`, 'g'),
  )) {
    add(m[2]!, MONTH_NUMBERS[m[1]!]!, m[3]);
  }

  if (reading.dates.length === 0 && reading.notes.length === 0) {
    const onlyMonth = scanner.peek(
      new RegExp(
        `(?:in|during|this|next|early|mid|late|end of|start of|beginning of)\\s+${MONTH}(?![a-z])`,
        'g',
      ),
    )[0];
    if (onlyMonth) {
      const name = MONTH_NAMES[MONTH_NUMBERS[onlyMonth[1]!]! - 1];
      reading.notes.push(
        `Which day in ${name} does the holiday start? Choose the first day below.`,
      );
    }
  }
  return reading;
}

/** `YYYY-MM-DD`, or undefined when there is no such day (31 April). */
function isoDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return date.toISOString().slice(0, 10);
}

function daysBetween(first: string, last: string): number {
  return Math.round(
    (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000,
  );
}

/** "10 April". */
function dayMonth(date: string): string {
  return `${Number(date.slice(8, 10))} ${MONTH_NAMES[Number(date.slice(5, 7)) - 1]}`;
}

// ---------------------------------------------------------------- nights

// prettier-ignore
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12,
};
const COUNT = '(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
/** Where a number or word starts: not inside another word or number. */
const START = '(?<![a-z\\d.])';

function countOf(word: string): number {
  return /^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word]!;
}

function readNights(scanner: Scanner): { values: number[]; questions: string[] } {
  const values = new Set<number>();
  for (const m of scanner.take(new RegExp(`${START}${COUNT}\\s*-?\\s*nights?(?![a-z])`, 'g'))) {
    values.add(countOf(m[1]!));
  }
  // Days and weeks don't say how many nights: people count them both ways.
  const questions: string[] = [];
  for (const m of scanner.take(new RegExp(`${START}${COUNT}\\s*-?\\s*days?(?![a-z])`, 'g'))) {
    const days = countOf(m[1]!);
    questions.push(`“${m[0].trim()}”: is that ${days - 1} or ${days} nights? Set Nights below.`);
  }
  for (const m of scanner.take(/(?<![a-z])(a|an|one|two|three|\d)\s*-?\s*weeks?(?![a-z])/g)) {
    const weeks = m[1] === 'a' || m[1] === 'an' ? 1 : countOf(m[1]!);
    questions.push(
      `“${m[0].trim()}”: is that ${weeks * 7 - 1} or ${weeks * 7} nights? Set Nights below.`,
    );
  }
  return { values: [...values], questions };
}

// ---------------------------------------------------------------- children

const KID =
  '(?:kids?|child(?:ren)?|sons?|daughters?|boys?|girls?|toddlers?|infants?|bab(?:y|ies)|teens?|teenagers?)';
const AGES = '(\\d{1,2}(?![\\d/.])(?:\\s*(?:,|and|&)\\s*\\d{1,2}(?![\\d/.]))*)';
const NOT_AN_AGE =
  '(?!\\s*(?:nights?|days?|weeks?|adults?|kids?|child|children|people|lakhs?|lacs?|k(?![a-z])))';

type ChildrenReading = {
  /** The children's ages, when the text says how many children travel (none included). */
  ages?: number[];
  withoutAges: number;
  /** The number of children, when the text says it. Adults are worked out from it ("family of 4"). */
  count?: number;
  notes: string[];
};

function readChildren(scanner: Scanner): ChildrenReading {
  const ages: number[] = [];
  const addAges = (written: string) => ages.push(...(written.match(/\d+/g) ?? []).map(Number));
  // aged 4 and 9, ages 4, 9
  for (const m of scanner.take(
    new RegExp(`(?<![a-z])(?:aged?|ages)\\s*(?:of\\s+)?${AGES}(?!\\d)${NOT_AN_AGE}`, 'g'),
  )) {
    addAges(m[1]!);
  }
  // a 6-year-old, 4 and 9 year olds, 6 years old, 6yo
  for (const m of scanner.take(
    new RegExp(`${AGES}\\s*-?\\s*(?:years?|yrs?)\\s*-?\\s*olds?(?![a-z])`, 'g'),
  )) {
    addAges(m[1]!);
  }
  for (const m of scanner.take(new RegExp(`${AGES}\\s*yo(?![a-z])`, 'g'))) addAges(m[1]!);
  // kids (4, 9)
  for (const m of scanner.take(
    new RegExp(`(?<![a-z])${KID}\\s*\\(\\s*${AGES}\\s*(?:years?|yrs?|y)?\\s*\\)`, 'g'),
  ))
    addAges(m[1]!);
  // my son is 6
  for (const m of scanner.take(
    /(?<![a-z])(?:son|daughter|kid|child|boy|girl)\s+(?:is|who is|who's)\s+(\d{1,2})(?!\d)/g,
  )) {
    addAges(m[1]!);
  }

  // How many: 2 kids, two children, a son, my daughter. A count may sit next to ages it shares a word with
  // ("2 kids aged 4 and 9"), so only the number itself must be unread.
  let counted: number | undefined;
  const addCount = (n: number) => (counted = (counted ?? 0) + n);
  for (const m of scanner.takeLeading(
    new RegExp(
      `(?<![a-z\\d.])(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\\s+(?:little\\s+|young\\s+|small\\s+)?${KID}(?![a-z])`,
      'g',
    ),
  )) {
    addCount(m[1] === 'a' || m[1] === 'an' ? 1 : countOf(m[1]!));
  }
  const mine = scanner.takeLeading(
    /(?<![a-z])(?:my|our)\s+(?:son|daughter|kid|child|boy|girl|baby)(?![a-z])/g,
  );
  if (mine.length > 0) addCount(mine.length);
  // kids 4 and 9: after the counts, so "2 kids 4 and 9" keeps its 2.
  for (const m of scanner.take(
    new RegExp(`(?<![a-z])${KID}\\s+${AGES}(?!\\d)${NOT_AN_AGE}(?!\\s*(?:years?|yrs?))`, 'g'),
  )) {
    addAges(m[1]!);
  }

  const none =
    scanner.take(
      /(?<![a-z])(?:no|without|zero)\s+(?:kids|children|child)(?![a-z])|(?<![a-z])(?:just|only)\s+(?:us\s+)?adults(?![a-z])|(?<![a-z])adults\s+only(?![a-z])/g,
    ).length > 0;

  const notes: string[] = [];
  if (none) {
    if (ages.length > 0 || (counted ?? 0) > 0) {
      notes.push('Your text says no children, and also mentions children: check Children below.');
      return { withoutAges: 0, notes };
    }
    return { ages: [], withoutAges: 0, count: 0, notes };
  }
  if (ages.length === 0 && (counted ?? 0) === 0) {
    if (scanner.peek(/(?<![a-z])(?:kids|children|sons|daughters)(?![a-z])/g).length > 0) {
      notes.push('Travelling with children? Add each child and their age below.');
    }
    return { withoutAges: 0, notes };
  }
  const total = counted ?? ages.length;
  if (total < ages.length) {
    notes.push(
      `Your text says ${count(total, 'child', 'children')} but gives ${count(ages.length, 'age')}: check Children below.`,
    );
    return { withoutAges: 0, notes };
  }
  const withoutAges = total - ages.length;
  if (withoutAges > 0) {
    if (withoutAges === total) {
      notes.push(total === 1 ? "Add the child's age below." : 'Add the age of each child below.');
    } else {
      notes.push(
        withoutAges === 1
          ? 'Add the age of the other child below.'
          : `Add the ages of the other ${withoutAges} children below.`,
      );
    }
  }
  return { ages, withoutAges, count: total, notes };
}

// ---------------------------------------------------------------- adults

const PARTNER = '(?:wife|husband|partner|spouse|girlfriend|boyfriend|fianc[eé]e?)';

function readAdults(
  scanner: Scanner,
  children: ChildrenReading,
): { value?: number; notes: string[] } {
  const values = new Set<number>();
  for (const m of scanner.take(
    new RegExp(`${START}${COUNT}\\s+(?:adults?|grown[\\s-]?ups?)(?![a-z])`, 'g'),
  )) {
    values.add(countOf(m[1]!));
  }
  const pairs = scanner.take(
    new RegExp(
      `(?<![a-z])(?:a\\s+)?couple(?![a-z])(?!\\s+of)|(?<![a-z])honeymoon|(?<![a-z])(?:me|i)\\s*(?:,|and|&)\\s*my\\s+${PARTNER}|(?<![a-z])my\\s+${PARTNER}\\s*(?:,|and|&)\\s*(?:i|me|myself)(?![a-z])`,
      'g',
    ),
  );
  if (pairs.length > 0) values.add(2);
  const alone = scanner.take(
    /(?<![a-z])(?:solo|alone|just\s+me|only\s+me|by\s+myself|on\s+my\s+own)(?![a-z])/g,
  );
  if (alone.length > 0) values.add(1);

  // A family of 4, 4 people, the 4 of us: adults are the rest once the children are known.
  const notes: string[] = [];
  const totals = scanner.take(
    new RegExp(
      `(?<![a-z])(?:family|group|party)\\s+of\\s+${COUNT}(?![\\d])|${START}${COUNT}\\s+(?:people|persons|pax|travell?ers|guests|of\\s+us)(?![a-z])|(?<![a-z])we\\s+are\\s+${COUNT}(?![\\d])`,
      'g',
    ),
  );
  for (const m of totals) {
    const total = countOf((m[1] ?? m[2] ?? m[3])!);
    if (children.count === undefined) {
      if (values.size === 0) {
        notes.push(
          `“${m[0].trim()}”: how many are adults, and how many are children? Set Adults and Children below.`,
        );
      }
    } else if (total - children.count >= 1) values.add(total - children.count);
  }

  if (values.size > 1) {
    notes.push(
      `Your text gives more than one number of adults (${list([...values].map(String))}): set Adults below.`,
    );
    return { notes };
  }
  const value = [...values][0];
  return value !== undefined && value >= 1 ? { value, notes } : { notes };
}

// ---------------------------------------------------------------- text helpers

/** Lowercase letters and digits, one space between words: "Fushimi-Inari!" -> "fushimi inari". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** "a, b and c". */
function list(items: string[], last = 'and'): string {
  return items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} ${last} ${items.at(-1)}`;
}

function count(n: number, word: string, plural = `${word}s`): string {
  return `${n} ${n === 1 ? word : plural}`;
}

function rupees(amount: number): string {
  return `₹${new Intl.NumberFormat('en-IN').format(amount)}`;
}

/** The lowercase text, and which characters a reader has already used. */
class Scanner {
  private readonly used: boolean[];

  constructor(readonly text: string) {
    this.used = new Array<boolean>(text.length).fill(false);
  }

  /** Every match that uses no character read before, in order. Its characters are then used. */
  take(pattern: RegExp): RegExpExecArray[] {
    const taken: RegExpExecArray[] = [];
    for (const match of this.text.matchAll(pattern)) {
      if (this.isUsed(match.index, match.index + match[0].length)) continue;
      this.used.fill(true, match.index, match.index + match[0].length);
      taken.push(match);
    }
    return taken;
  }

  /** Like `take`, but only the match's first word must be unread, and only it is used. */
  takeLeading(pattern: RegExp): RegExpExecArray[] {
    const taken: RegExpExecArray[] = [];
    for (const match of this.text.matchAll(pattern)) {
      const end = match.index + (match[0].match(/^\S+/)?.[0].length ?? match[0].length);
      if (this.isUsed(match.index, end)) continue;
      this.used.fill(true, match.index, end);
      taken.push(match);
    }
    return taken;
  }

  /** Every match that uses no character read before. Uses nothing. */
  peek(pattern: RegExp): RegExpExecArray[] {
    return [...this.text.matchAll(pattern)].filter(
      (match) => !this.isUsed(match.index, match.index + match[0].length),
    );
  }

  private isUsed(start: number, end: number): boolean {
    return this.used.slice(start, end).some(Boolean);
  }
}
