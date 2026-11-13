import type { FieldError } from '@bh/shared/common';
import type { HolidayRequest } from '@bh/shared/holiday-package';
import type { Catalog } from '../catalog/catalog.logic';
import { addDays, formatDate } from './time.logic';

/**
 * Checks the values of a request against the data (M1). The shape was already checked by `holidayRequestSchema`.
 * Every limit comes from destinations.json, never from code. Returns one message per field that is not valid.
 */
export function checkRequest(request: HolidayRequest, catalog: Catalog): FieldError[] {
  const { departure_cities, countries, rules } = catalog.destinations;
  const { first_night, last_departure } = rules.data_window;
  const errors: FieldError[] = [];

  if (!departure_cities.some((d) => d.airport === request.departureAirport)) {
    errors.push({ path: 'departureAirport', message: 'Choose a departure city from the list' });
  }
  if (!countries.some((c) => c.code === request.country)) {
    errors.push({ path: 'country', message: 'Choose a country from the list' });
  }
  if (request.nights < rules.min_nights || request.nights > rules.max_nights) {
    errors.push({
      path: 'nights',
      message: `Choose ${rules.min_nights} to ${rules.max_nights} nights`,
    });
  }
  if (request.startDate < first_night) {
    errors.push({
      path: 'startDate',
      message: `The holiday can start on ${formatDate(first_night)} at the earliest`,
    });
  } else if (addDays(request.startDate, request.nights) > last_departure) {
    errors.push({
      path: 'startDate',
      message:
        `Flights and rooms exist until ${formatDate(last_departure)}. With ${request.nights} nights, ` +
        `start by ${formatDate(addDays(last_departure, -request.nights))}`,
    });
  }
  return errors;
}
