import type {
  ChangeRequest,
  FlightChoice,
  FlightDirection,
  HotelChoice,
} from '@bh/shared/package-change';
import type { UseQueryResult } from '@tanstack/react-query';
import { useId } from 'react';
import { Empty } from '@/components/states/empty';
import { ErrorState } from '@/components/states/error-state';
import { Loading } from '@/components/states/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatInr, formatInrDifference, formatLocalDate } from '@/lib/format';
import { useApplyChange, useFlightChoices, useHotelChoices } from '../hooks';

/** What the traveler is changing: the hotel of one city, or one of the two flights. */
export type ChangeTarget =
  { kind: 'hotel'; city: string } | { kind: 'flight'; direction: FlightDirection };

/**
 * Choosing means comparing the best few, and the list comes ranked (the current choice, then the smallest
 * difference), so the first rows do the work and the rest wait behind "Show more" (DESIGN.md, The Show-Less Rule).
 */
const SHOWN = 5;

type PanelProps = {
  packageId: string;
  target: ChangeTarget;
  /** Called once a change is saved, before the panel closes. */
  onApplied: () => void;
  onClose: () => void;
};

/** The choices for one part of the package, each with what it does to the total. Picking one applies it. */
export function ChangePanel({ target, ...props }: PanelProps) {
  return target.kind === 'hotel' ? (
    <HotelChoices city={target.city} {...props} />
  ) : (
    <FlightChoices direction={target.direction} {...props} />
  );
}

type Shared = Omit<PanelProps, 'target'>;

function HotelChoices({ city, ...props }: Shared & { city: string }) {
  const query = useHotelChoices(props.packageId, city);
  return (
    <Choices
      {...props}
      title={`Change your hotel in ${city}`}
      query={query}
      hiddenNote={(n) => `${count(n, 'room type')} not listed: too small for everyone.`}
      toRow={(choice: HotelChoice) => ({
        key: choice.roomId,
        name: `${choice.hotelName}, ${choice.roomName}`,
        details: `${choice.area} · ${choice.stars} stars · ${count(choice.rooms, 'room')} · ${count(choice.nights, 'night')}`,
        change: { type: 'hotel', city, hotelId: choice.hotelId, roomId: choice.roomId },
      })}
    />
  );
}

function FlightChoices({ direction, ...props }: Shared & { direction: FlightDirection }) {
  const query = useFlightChoices(props.packageId, direction);
  return (
    <Choices
      {...props}
      title={direction === 'arrival' ? 'Change your flight there' : 'Change your flight home'}
      query={query}
      hiddenNote={(n) => `${count(n, 'flight')} not listed: too few seats left for everyone.`}
      toRow={(choice: FlightChoice) => ({
        key: choice.flightId,
        name: `${choice.flightNumber} ${choice.from} to ${choice.to}`,
        details: flightDetails(choice),
        change: { type: 'flight', direction, flightId: choice.flightId },
      })}
    />
  );
}

type Row = { key: string; name: string; details: string; change: ChangeRequest };

type ChoicesProps<C extends HotelChoice | FlightChoice> = Shared & {
  title: string;
  query: UseQueryResult<{ data: { choices: C[]; hidden: number } }>;
  toRow: (choice: C) => Row;
  hiddenNote: (hidden: number) => string;
};

function Choices<C extends HotelChoice | FlightChoice>({
  packageId,
  title,
  query,
  toRow,
  hiddenNote,
  onApplied,
  onClose,
}: ChoicesProps<C>) {
  const headingId = useId();
  const apply = useApplyChange(packageId);
  const refused = apply.data?.data.result === 'REFUSED' ? apply.data.data.problems : null;

  function pick(change: ChangeRequest) {
    apply.mutate(change, {
      onSuccess: ({ data }) => {
        if (data.result !== 'APPLIED') return;
        onApplied();
        onClose();
      },
    });
  }

  function list(choices: C[]) {
    return (
      <ul className="divide-y">
        {choices.map((choice) => {
          const row = toRow(choice);
          return (
            <ChoiceRow
              key={row.key}
              row={row}
              choice={choice}
              disabled={apply.isPending}
              onPick={() => pick(row.change)}
            />
          );
        })}
      </ul>
    );
  }

  let body;
  if (query.isPending) {
    body = <Loading label="Checking every choice against the rules…" />;
  } else if (query.isError) {
    body = <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  } else {
    const { choices, hidden } = query.data.data;
    body =
      choices.length === 0 ? (
        <Empty title="Nothing else fits" description={hiddenNote(hidden)} />
      ) : (
        <>
          {refused && (
            <div
              role="alert"
              className="space-y-1 rounded-md border-2 border-destructive p-3 text-sm"
            >
              <p className="font-semibold text-destructive">
                Nothing changed. That choice breaks a rule:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {refused.map((problem) => (
                  <li key={`${problem.rule}-${problem.itemId}-${problem.message}`}>
                    {problem.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {apply.isError && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {getErrorMessage(apply.error)}
            </p>
          )}
          {apply.isPending && (
            <p role="status" className="text-sm text-muted-foreground">
              Checking your whole holiday again…
            </p>
          )}
          {list(choices.slice(0, SHOWN))}
          {choices.length > SHOWN && (
            <details className="space-y-3">
              <summary className="w-fit cursor-pointer rounded-md text-sm font-semibold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none">
                Show {choices.length - SHOWN} more
              </summary>
              {list(choices.slice(SHOWN))}
            </details>
          )}
          {hidden > 0 && <p className="text-sm text-muted-foreground">{hiddenNote(hidden)}</p>}
        </>
      );
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3 border-t-2 pt-4">
      <div className="flex items-center justify-between gap-4">
        <h4 id={headingId} className="font-bold">
          {title}
        </h4>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      {body}
    </section>
  );
}

/**
 * One choice: name, details, its own price and what it does to the total. A blocked choice shows why and can still
 * be picked; the change then comes back refused with the same reason. The current choice is shown, not picked.
 */
function ChoiceRow({
  row,
  choice,
  disabled,
  onPick,
}: {
  row: Row;
  choice: HotelChoice | FlightChoice;
  disabled: boolean;
  onPick: () => void;
}) {
  const content = (
    <>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">
          {row.name}
          {choice.current && (
            <Badge variant="secondary" className="ml-2 align-middle">
              Current
            </Badge>
          )}
        </p>
        <p className="text-sm text-muted-foreground">{row.details}</p>
        {choice.status === 'BLOCKED' && (
          <p className="w-fit rounded-md bg-caution px-2 py-1 text-sm text-caution-foreground">
            {choice.reason}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold tabular-nums">{formatInr(choice.priceInr)}</p>
        {choice.status === 'READY' && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatInrDifference(choice.differenceInr)} total
          </p>
        )}
      </div>
    </>
  );

  if (choice.current) return <li className="flex gap-4 py-3">{content}</li>;
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onPick}
        className="-mx-2 flex w-[calc(100%+1rem)] gap-4 rounded-md px-2 py-3 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none disabled:opacity-50"
      >
        {content}
      </button>
    </li>
  );
}

/** "Fri, 9 Apr 2027, 23:50 – 10:30 next day · direct". Each time is local to its own airport. */
function flightDetails(choice: FlightChoice): string {
  const nextDay = choice.arrives.slice(0, 10) > choice.departs.slice(0, 10) ? ' next day' : '';
  const stops = choice.stops === 0 ? 'direct' : count(choice.stops, 'stop');
  return `${formatLocalDate(choice.departs)}, ${choice.departs.slice(11)} – ${choice.arrives.slice(11)}${nextDay} · ${stops}`;
}

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
