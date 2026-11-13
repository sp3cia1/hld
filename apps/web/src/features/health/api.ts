import { healthResponseSchema } from '@bh/shared/health';
import { apiRequest } from '@/lib/api-client';

export function fetchHealth() {
  return apiRequest('/health', { schema: healthResponseSchema });
}
