import type { FreeTime, TripItem } from '@bh/shared/holiday-package';
import { BedDouble, Car, Landmark, Plane, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChangePanel, type ChangeTarget } from '@/features/package-changes/components/change-panel';
import { useChangePending } from '@/features/package-changes/hooks';
import { formatInr, formatLocalDate } from '@/lib/format';
import { FreeTimeList } from './free-time-list';

type DayByDayProps = {
  packageId: string;
  items: TripItem[];
  freeTime: FreeTime[];
  /** Called after a change to the package is saved. */
  onChanged: () => void;
};

/**
 * The package day by day (M4): each day that has something on it, items in the package's own time order. A day the
 * package leaves free also lists what still fits once the traveler reaches the hotel. Each hotel and flight can be
 * changed (M6); one change panel is open at a time.
 */
export function DayByDay({ packageId, items, freeTime, onChanged }: DayByDayProps) {
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const pending = useChangePending(packageId);
  const arrivalFlightId = items.find((item) => item.type === 'flight')?.item_id;

  function targetOf(item: TripItem): ChangeTarget | null {
    if (item.type === 'hotel') return { kind: 'hotel', city: item.city };
    if (item.type === 'flight') {
      return { kind: 'flight', direction: item.item_id === arrivalFlightId ? 'arrival' : 'return' };
    }
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2>Day by day</h2>
        <p className="text-sm text-muted-foreground">Every time is local to where it happens.</p>
      </div>
      {groupByDay(items).map(({ day, dayItems }) => {
        const free = freeTime.find((f) => f.date === day);
        return (
          <Card key={day}>
            <CardContent className="space-y-4">
              <h3 className="text-lg font-bold">{formatLocalDate(day)}</h3>
              <ul className="divide-y">
                {dayItems.map((item) => {
                  const target = targetOf(item);
                  const open = openItemId === item.item_id;
                  return (
                    <ItemRow
                      key={item.item_id}
                      item={item}
                      action={
                        target && (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-expanded={open}
                            disabled={pending}
                            onClick={() => setOpenItemId(open ? null : item.item_id)}
                          >
                            Change
                          </Button>
                        )
                      }
                    >
                      {open && target && (
                        <ChangePanel
                          packageId={packageId}
                          target={target}
                          onApplied={onChanged}
                          onClose={() => setOpenItemId(null)}
                        />
                      )}
                    </ItemRow>
                  );
                })}
              </ul>
              {free && <FreeTimeList freeTime={free} />}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

function ItemRow({
  item,
  action,
  children,
}: {
  item: TripItem;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="space-y-4 py-3 first:pt-0 last:pb-0">
      <div className="flex gap-4">
        <p className="w-36 shrink-0 text-sm tabular-nums">{timeLabel(item)}</p>
        <div className="min-w-0 flex-1 space-y-1">
          <KindLabel type={item.type} />
          <p className="font-semibold">{item.name}</p>
          <p className="text-sm text-muted-foreground">{details(item)}</p>
          {item.warnings.map((warning) => (
            <p
              key={warning}
              className="w-fit rounded-md bg-caution px-2 py-1 text-sm text-caution-foreground"
            >
              {warning}
            </p>
          ))}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="font-semibold tabular-nums">
            {item.price_inr === 0 ? 'Free' : formatInr(item.price_inr)}
          </p>
          {action}
        </div>
      </div>
      {children}
    </li>
  );
}

const KINDS: Record<TripItem['type'], { label: string; Icon: LucideIcon }> = {
  flight: { label: 'Flight', Icon: Plane },
  transfer: { label: 'Transfer', Icon: Car },
  hotel: { label: 'Hotel', Icon: BedDouble },
  attraction: { label: 'Visit', Icon: Landmark },
};

/** What kind of item this is, so a day's list can be scanned at a glance. */
function KindLabel({ type }: { type: TripItem['type'] }) {
  const { label, Icon } = KINDS[type];
  return (
    <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
      <Icon aria-hidden className="size-4" />
      {label}
    </p>
  );
}

/** Groups items by the local date they start on, keeping their order. */
function groupByDay(items: TripItem[]): { day: string; dayItems: TripItem[] }[] {
  const days: { day: string; dayItems: TripItem[] }[] = [];
  for (const item of items) {
    const day = item.start.slice(0, 10);
    const last = days.at(-1);
    if (last?.day === day) last.dayItems.push(item);
    else days.push({ day, dayItems: [item] });
  }
  return days;
}

/** "23:50 – 10:30 next day". A hotel item has dates only, so it reads "Check-in". */
function timeLabel(item: TripItem): string {
  if (item.type === 'hotel') return 'Check-in';
  const start = item.start.slice(11, 16);
  if (!item.end) return start;
  const nextDay = item.end.slice(0, 10) > item.start.slice(0, 10) ? ' next day' : '';
  return `${start} – ${item.end.slice(11, 16)}${nextDay}`;
}

function details(item: TripItem): string {
  switch (item.type) {
    case 'flight':
      return `Flight to ${item.city} · ${count(item.quantity, 'seat')}`;
    case 'hotel':
      return `Hotel in ${item.city} · until ${formatLocalDate(item.end ?? item.start)} · ${count(item.quantity, 'room')}`;
    // A transfer's quantity is vehicles or tickets depending on how it is priced, so it isn't shown.
    case 'transfer':
      return `Transfer in ${item.city}`;
    case 'attraction':
      return `Visit in ${item.city} · ${count(item.quantity, 'ticket')}`;
  }
}

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
