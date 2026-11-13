import { reservationResponseSchema, type ConfirmRequest } from '@bh/shared/reservation';
import { apiRequest } from '@/lib/api-client';

export function confirmPackage(request: ConfirmRequest) {
  return apiRequest('/reservations', {
    schema: reservationResponseSchema,
    method: 'POST',
    body: request,
  });
}

export function fetchReservation(reference: string) {
  return apiRequest(`/reservations/${encodeURIComponent(reference)}`, {
    schema: reservationResponseSchema,
  });
}