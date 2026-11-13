// The numbers in the statement's travel rules (§4), in one place. Limits that come from the data (nights, the
// date window) are read from destinations.json instead.

/** The airport pickup is at least this many minutes after landing. */
export const MIN_MINUTES_AFTER_LANDING = 60;

/** The traveler reaches the airport at least this many minutes before departure. */
export const MIN_MINUTES_BEFORE_DEPARTURE = 180;

/** Our choice, not a rule: visits on a full day start at this time, or at opening time if that is later. */
export const VISITS_START_AT = '09:00';

/**
 * Our choice, not a rule: on a city-change day the train, bus or taxi to the next city leaves at the first departure
 * at or after this time, a calm start after breakfast.
 */
export const HOPS_LEAVE_AT = '10:00';
