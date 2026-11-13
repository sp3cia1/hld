import type { Options } from '@bh/shared/options';
import { getCatalog } from '../catalog/catalog.loader';

/** The departure cities and countries the request form offers, in the order of destinations.json. */
export function getOptions(): Options {
  const { departure_cities, countries } = getCatalog().destinations;
  return {
    departureCities: departure_cities.map(({ airport, city }) => ({ airport, city })),
    countries: countries.map(({ code, name }) => ({ code, name })),
  };
}
