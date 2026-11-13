import {
  buildResponseSchema,
  cityPlanChoicesResponseSchema,
  packageResponseSchema,
  type CityPlan,
  type HolidayRequest,
} from '@bh/shared/holiday-package';
import { optionsResponseSchema } from '@bh/shared/options';
import { quickRequestResponseSchema } from '@bh/shared/quick-request';
import { tripCheckResponseSchema } from '@bh/shared/trip-check';
import { tripExportResponseSchema } from '@bh/shared/trip-export';
import { apiRequest } from '@/lib/api-client';

export function fetchOptions() {
  return apiRequest('/options', { schema: optionsResponseSchema });
}

export function createPackage(request: HolidayRequest) {
  return apiRequest('/packages', { schema: buildResponseSchema, method: 'POST', body: request });
}

export function fetchPackage(id: string) {
  return apiRequest(`/packages/${encodeURIComponent(id)}`, { schema: packageResponseSchema });
}

export function fetchPackageCheck(id: string) {
  return apiRequest(`/packages/${encodeURIComponent(id)}/check`, {
    schema: tripCheckResponseSchema,
  });
}

export function fetchPackageExport(id: string) {
  return apiRequest(`/packages/${encodeURIComponent(id)}/export`, {
    schema: tripExportResponseSchema,
  });
}

export function readQuickRequest(text: string) {
  return apiRequest('/quick-request', {
    schema: quickRequestResponseSchema,
    method: 'POST',
    body: { text },
  });
}

export function fetchCityPlans(id: string) {
  return apiRequest(`/packages/${encodeURIComponent(id)}/city-plans`, {
    schema: cityPlanChoicesResponseSchema,
  });
}

export function rebuildPackage(id: string, cityPlan: CityPlan) {
  return apiRequest(`/packages/${encodeURIComponent(id)}/rebuild`, {
    schema: buildResponseSchema,
    method: 'POST',
    body: { cityPlan },
  });
}
