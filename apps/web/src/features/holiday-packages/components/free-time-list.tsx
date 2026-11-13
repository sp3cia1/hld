import type { FreeTime } from '@bh/shared/holiday-package';
import { Button } from '@/components/ui/button';
import { useApplyChange, useChangePending } from '@/features/package-changes/hooks';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDuration, formatInr } from '@/lib/format';

/**
 * A free afternoon is one small decision: which one or two to add. The cheapest few show; the rest wait behind
 * "Show more" (DESIGN.md, The Show-Less Rule).
 */
const SHOWN = 3;

type FreeTimeListProps = {
  packageId: string;
  freeTime: FreeTime;
  /** Called after a visit from the list is saved. */
  onAdded: () => void;
};

/**
 * What still fits on a day the package leaves free, once the traveler reaches the hotel. "Add" makes the same change
 * as the day's "Add a visit" list.
 */
export function FreeTimeList({ packageId, freeTime, onAdded }: FreeTimeListProps) {
  const { date, freeFrom, stationTaxiInr, attractions } = freeTime;
  const more = attractions.slice(SHOWN);
  const add = useApplyChange(packageId);
  const pending = useChangePending(packageId);
  const tried = add.variables?.type === 'add_attraction' ? add.variables.attractionId : null;
  const problem =
    add.data?.data.result === 'REFUSED'
      ? add.data.data.problems[0]!.message
      : add.isError
        ? getErrorMessage(add.error)
        : null;
  const options = (list: FreeTime['attractions']) => (
    <Options
      attractions={list}
      date={date}
      disabled={pending}
      problemFor={(id) => (id === tried ? problem : null)}
      onAdd={(attractionId) =>
        add.mutate(
          { type: 'add_attraction', date, attractionId },
          { onSuccess: ({ data }) => data.result === 'APPLIED' && onAdded() },
        )
      }
    />
  );
  return (
    <section className="space-y-3 border-t-2 pt-4">
      <h4 className="font-bold">Free time</h4>
      <p className="text-sm text-muted-foreground">
        You're at the hotel by {clock(freeFrom, date)}. These still fit {partOfDay(freeFrom)}:
      </p>
      {options(attractions.slice(0, SHOWN))}
      {more.length > 0 && (
        <details className="space-y-3">
          <summary className="w-fit cursor-pointer rounded-md text-sm font-semibold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none">
            Show {more.length} more
          </summary>
          {options(more)}
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

function Options({
  attractions,
  date,
  disabled,
  problemFor,
  onAdd,
}: {
  attractions: FreeTime['attractions'];
  date: string;
  disabled: boolean;
  /** Why adding this attraction was refused, or null. */
  problemFor: (attractionId: string) => string | null;
  onAdd: (attractionId: string) => void;
}) {
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
            {problemFor(attraction.attractionId) && (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {problemFor(attraction.attractionId)}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <p className="font-semibold tabular-nums">
              {attraction.priceInr === 0 ? 'Free' : formatInr(attraction.priceInr)}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onAdd(attraction.attractionId)}
            >
              Add
            </Button>
          </div>
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
