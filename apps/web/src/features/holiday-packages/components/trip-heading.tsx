import type { Trip } from '@bh/shared/holiday-package';
import { formatList, formatLocalDate } from '@/lib/format';

/** A page heading for a trip, with its dates, departure airport and travelers underneath. */
export function TripHeading({ title, trip }: { title: string; trip: Trip }) {
  return (
    <div className="space-y-2">
      <h1>{title}</h1>
      <p className="text-muted-foreground">
        {formatLocalDate(trip.start_date)} to {formatLocalDate(trip.end_date)} · from{' '}
        {trip.traveler.home_airport} · {travelers(trip.traveler)}
      </p>
    </div>
  );
}

/** "2 adults and 2 children aged 4 and 9". */
function travelers({ adults, child_ages }: Trip['traveler']): string {
  const grown = `${adults} ${adults === 1 ? 'adult' : 'adults'}`;
  if (child_ages.length === 0) return grown;
  const kids = child_ages.length === 1 ? '1 child' : `${child_ages.length} children`;
  return `${grown} and ${kids} aged ${formatList(child_ages.map(String))}`;
}