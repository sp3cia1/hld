import { dataResponseSchema } from './common';
import { tripSchema } from './holiday-package';

/**
 * What GET /api/packages/:id/export returns inside `{ data }`: the package in the shared trip format
 * (DATA_DICTIONARY.md §4, plus `country` and `room_id`). After confirm it is the booked snapshot: `status` BOOKED and
 * `booking.reference` on every item. The browser saves `data` as the JSON file.
 */
export const tripExportResponseSchema = dataResponseSchema(tripSchema);
