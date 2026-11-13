import { holidayRequestSchema, type HolidayRequest } from '@bh/shared/holiday-package';
import { z } from 'zod';

// The form keeps each child as `{ age }`, because react-hook-form's field arrays need objects.
// Everything else is the request itself, checked by the shared schema.
export const requestFormSchema = holidayRequestSchema.omit({ childAges: true }).extend({
  children: z.array(z.object({ age: holidayRequestSchema.shape.childAges.element })),
});
export type RequestFormValues = z.infer<typeof requestFormSchema>;

export function toHolidayRequest({ children, ...rest }: RequestFormValues): HolidayRequest {
  return { ...rest, childAges: children.map((child) => child.age) };
}

/** Maps a field path from the API (`childAges.0`) to the form's own (`children.0.age`). */
export function toFormPath(apiPath: string): string {
  const child = /^childAges\.(\d+)$/.exec(apiPath);
  return child ? `children.${child[1]}.age` : apiPath;
}
