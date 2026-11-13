import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { buildCatalog, type Catalog, type CatalogFiles } from './catalog.logic';
import {
  airportSchema,
  attractionSchema,
  availabilitySchema,
  destinationsSchema,
  flightSchema,
  hotelSchema,
  roomSchema,
  transferSchema,
} from './catalog.schemas';

/** The catalog files as the organisers ship them. Read-only: never write here. */
const CATALOG_DIR = new URL(
  '../../../../../data/raw/hackathon-problem-1-holiday-package/data/catalog/',
  import.meta.url,
);

let catalog: Catalog | undefined;

/** The catalog, read and checked on first use. `server.ts` calls it at startup so bad data stops the API early. */
export function getCatalog(): Catalog {
  catalog ??= loadCatalog(CATALOG_DIR);
  return catalog;
}

/** Reads the 8 files, checks every record against the data dictionary, and builds the indexes. */
export function loadCatalog(dir: URL): Catalog {
  const files: CatalogFiles = {
    destinations: read(dir, 'destinations.json', destinationsSchema),
    airports: read(dir, 'airports.json', z.array(airportSchema)),
    flights: read(dir, 'flights.json', z.array(flightSchema)),
    hotels: read(dir, 'hotels.json', z.array(hotelSchema)),
    rooms: read(dir, 'rooms.json', z.array(roomSchema)),
    availability: read(dir, 'availability.json', z.array(availabilitySchema)),
    transfers: read(dir, 'transfers.json', z.array(transferSchema)),
    attractions: read(dir, 'attractions.json', z.array(attractionSchema)),
  };
  return buildCatalog(files);
}

function read<T extends z.ZodType>(dir: URL, file: string, schema: T): z.infer<T> {
  const raw: unknown = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
  const result = schema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .slice(0, 10)
      .map((issue) => `  ${file} ${describePath(issue.path)}: ${issue.message}`);
    throw new Error(`The catalog does not match the data dictionary:\n${problems.join('\n')}`);
  }
  return result.data;
}

/** `[212, 'price_per_seat', 'amount']` -> `record 212, price_per_seat.amount`. */
function describePath(path: PropertyKey[]): string {
  const [first, ...rest] = path;
  return typeof first === 'number'
    ? `record ${first}${rest.length > 0 ? `, ${rest.map(String).join('.')}` : ''}`
    : path.map(String).join('.');
}
