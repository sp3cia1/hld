import {
  changeResponseSchema,
  flightChoicesResponseSchema,
  hotelChoicesResponseSchema,
  type ChangeRequest,
  type FlightDirection,
} from '@bh/shared/package-change';
import { apiRequest, toQueryString } from '@/lib/api-client';

function packagePath(packageId: string) {
  return `/packages/${encodeURIComponent(packageId)}`;
}

export function fetchHotelChoices(packageId: string, city: string) {
  return apiRequest(`${packagePath(packageId)}/choices/hotel${toQueryString({ city })}`, {
    schema: hotelChoicesResponseSchema,
  });
}

export function fetchFlightChoices(packageId: string, direction: FlightDirection) {
  return apiRequest(`${packagePath(packageId)}/choices/flight${toQueryString({ direction })}`, {
    schema: flightChoicesResponseSchema,
  });
}

export function applyChange(packageId: string, change: ChangeRequest) {
  return apiRequest(`${packagePath(packageId)}/changes`, {
    schema: changeResponseSchema,
    method: 'POST',
    body: change,
  });
}
