import { apiErrorSchema } from '@bh/shared/common';
import type { z } from 'zod';

/** Every failed API call throws this. `code` matches the API's error codes (see error-messages.ts). */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly requestId?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Builds "?a=1&b=2" from params, skipping undefined and empty values. Returns "" when none are left. */
export function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

type RequestOptions<S extends z.ZodType> = {
  /** The success response is validated against this shared schema. */
  schema: S;
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
};

/** Calls `/api<path>`, returns the response parsed with `options.schema`, throws `ApiError` on failure. */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  { schema, method = 'GET', body, headers }: RequestOptions<S>,
): Promise<z.infer<S>> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 0, 'Could not reach the server');
  }

  const json: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    // No JSON body means the answer did not come from our API. The Vite dev proxy, for example,
    // answers 500/502/504 with an empty or HTML body when the API is down. Treat that as unreachable.
    if (json === undefined) {
      throw new ApiError('NETWORK_ERROR', response.status, 'Could not reach the server');
    }
    const parsed = apiErrorSchema.safeParse(json);
    if (!parsed.success)
      throw new ApiError('UNKNOWN', response.status, 'Unexpected error response');
    const { code, message, requestId, details } = parsed.data.error;
    throw new ApiError(code, response.status, message, requestId, details);
  }

  return schema.parse(json);
}
