import type { FreeTime } from '@bh/shared/holiday-package';
import { formatDuration, formatInr } from '@/lib/format';

/**
 * A free afternoon is one small decision: which one or two to add. The cheapest few show; the rest wait behind
 * "Show more" (DESIGN.md, The Show-Less Rule).
 */
const SHOWN = 3;

/** What still fits on a day the package leaves free, once the traveler reaches the hotel. */
export function FreeTimeList({ freeTime }: { freeTime: FreeTime }) {
  const { date, freeFrom, stationTaxiInr, attractions } = freeTime;
  const more = attractions.slice(SHOWN);
  return (
    <section className="space-y-3 border-t-2 pt-4">
      <h4 className="font-bold">Free time</h4>
      <p className="text-sm text-muted-foreground">
        You're at the hotel by {clock(freeFrom, date)}. These still fit {partOfDay(freeFrom)}:
      </p>
      <Options attractions={attractions.slice(0, SHOWN)} date={date} />
      {more.length > 0 && (
        <details className="space-y-3">
          <summary className="w-fit cursor-pointer rounded-md text-sm font-semibold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none">
            Show {more.length} more
          </summary>
          <Options attractions={more} date={date} />
        </details>
      )}
      {stationTaxiInr !== null && (
        <p className="text-sm text-muted-foreground">
          A visit today also adds the taxi from the station to your hotel:{' '}
          {formatInr(stationTaxiInr)}.
        </p>
      )}
    </section>
  );
}

function Options({ attractions, date }: { attractions: FreeTime['attractions']; date: string }) {
  return (
    <ul className="divide-y">
      {attractions.map((attraction) => (
        <li key={attraction.attractionId} className="flex gap-4 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold">{attraction.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatDuration(attraction.visitMinutes)} · from{' '}
              {clock(attraction.earliestStart, date)} · open until {clock(attraction.endBy, date)}
            </p>
          </div>
          <p className="shrink-0 font-semibold tabular-nums">
            {attraction.priceInr === 0 ? 'Free' : formatInr(attraction.priceInr)}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** "13:00" on the day itself, "midnight" at the end of it, "00:30 next day" after it. */
function clock(local: string, date: string): string {
  const time = local.slice(11, 16);
  if (local.slice(0, 10) === date) return time;
  return time === '00:00' ? 'midnight' : `${time} next day`;
}

/** The rest of the day, named from when it starts. */
function partOfDay(local: string): string {
  const hour = Number(local.slice(11, 13));
  if (hour >= 17) return 'this evening';
  if (hour >= 12) return 'this afternoon';
  return 'today';
}
