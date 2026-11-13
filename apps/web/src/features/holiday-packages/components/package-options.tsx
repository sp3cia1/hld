import type { PackageLabel, PackageOption, Trip } from '@bh/shared/holiday-package';
import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDuration, formatInr } from '@/lib/format';
import { fetchPackage } from '../api';
import { packageKey } from '../hooks';
import type { PackagePageState } from '../pages/package-page';

const LABELS: Record<PackageLabel, string> = {
  CHEAPEST: 'Cheapest',
  FASTEST: 'Fastest',
  BEST_RATED: 'Best rated',
};

/**
 * The packages offered for one request (G4): the cheapest, the fastest and the best rated. Each is a saved package of
 * its own, so the traveler can open, change and confirm any of them. Each card reads its package live, so its numbers
 * stay right after a change.
 */
export function PackageOptions({
  options,
  current,
}: {
  options: PackageOption[];
  current: string;
}) {
  const packages = useQueries({
    queries: options.map((option) => ({
      queryKey: packageKey(option.packageId),
      queryFn: () => fetchPackage(option.packageId),
    })),
  });
  // The cards keep the list in the history entry, so every package they open shows them too.
  const state: PackagePageState = { options };

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2>Choose your package</h2>
        <p className="text-sm text-muted-foreground">
          Open one to see its plan, change it or book it.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {options.map((option, i) => {
          const saved = packages[i]?.data?.data;
          const open = option.packageId === current;
          return (
            <Card key={option.packageId} asChild interactive>
              <Link
                to={`/packages/${option.packageId}`}
                state={state}
                aria-current={open ? 'page' : undefined}
              >
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap gap-2">
                    {option.labels.map((label) => (
                      <Badge key={label}>{LABELS[label]}</Badge>
                    ))}
                    {open && <Badge variant="secondary">Open below</Badge>}
                  </div>
                  {saved ? (
                    <div className="space-y-1">
                      <p className="text-xl font-extrabold tabular-nums">
                        {formatInr(saved.trip.total_inr)}
                      </p>
                      <p className="text-sm text-muted-foreground">{cities(saved.trip)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDuration(saved.summary.travelMinutes)} travel ·{' '}
                        {stars(saved.summary.averageStars)} hotels
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  )}
                </CardContent>
              </Link>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/** "Tokyo → Osaka": the cities in travel order. */
function cities(trip: Trip): string {
  return trip.items
    .filter((item) => item.type === 'hotel')
    .map((item) => item.city)
    .join(' → ');
}

/** "5★", or "4.6★" for an average. */
function stars(average: number): string {
  return `${Number.isInteger(average) ? average : average.toFixed(1)}★`;
}
