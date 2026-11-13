import type { CityPlan, Trip } from '@bh/shared/holiday-package';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ErrorState } from '@/components/states/error-state';
import { Loading } from '@/components/states/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/error-messages';
import { formatInr } from '@/lib/format';
import { useCityPlans, useRebuildPackage } from '../hooks';
import type { PackagePageState } from '../pages/package-page';

/** The plans shown before "Show more". The traveler weighs the cheapest few (DESIGN.md, The Show-Less Rule). */
const SHOWN = 5;

/**
 * The trip's cities and nights, and "Change cities" (G3): every valid city plan with its cheapest total, or why it can't
 * be built. Picking one builds the cheapest, fastest and best-rated packages again for those cities and opens them.
 * A confirmed holiday shows its cities only.
 */
export function CityPlanBar({
  packageId,
  trip,
  canChange,
}: {
  packageId: string;
  trip: Trip;
  canChange: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const plans = useCityPlans(packageId, open);
  const rebuild = useRebuildPackage(packageId);
  const navigate = useNavigate();
  const current = trip.items
    .filter((item) => item.type === 'hotel')
    .map((item) => ({
      city: item.city,
      nights: nightsBetween(item.start, item.end ?? item.start),
    }));

  function choose(cityPlan: CityPlan) {
    rebuild.mutate(cityPlan, {
      onSuccess: ({ data }) => {
        if (data.status === 'NO_PACKAGE') return;
        const state: PackagePageState = { justBuilt: true, options: data.options };
        void navigate(`/packages/${data.packageId}`, { state });
        setOpen(false);
      },
    });
  }

  const choices = plans.data?.data.choices ?? [];
  const ordered = [...choices].sort((a, b) => (a.totalInr ?? Infinity) - (b.totalInr ?? Infinity));
  const shown = showAll ? ordered : ordered.slice(0, SHOWN);
  const noPackage = rebuild.data?.data.status === 'NO_PACKAGE' ? rebuild.data.data.reason : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-lg font-bold">{planText(current)}</p>
        {canChange && (
          <Button variant="outline" size="sm" onClick={() => setOpen((was) => !was)}>
            {open ? 'Close' : 'Change cities'}
          </Button>
        )}
      </div>
      {open && (
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <h2>Choose your cities</h2>
              <p className="text-sm text-muted-foreground">
                We build the cheapest, fastest and best-rated packages again for the cities you
                pick. Hotels, flights and visits are chosen again too.
              </p>
            </div>
            {plans.isPending && <Loading label="Pricing every city plan…" />}
            {plans.isError && (
              <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
            )}
            {rebuild.isError && (
              <p role="alert" className="text-sm text-destructive">
                {getErrorMessage(rebuild.error)}
              </p>
            )}
            {noPackage && (
              <p role="alert" className="text-sm text-destructive">
                {noPackage.message}
              </p>
            )}
            {plans.isSuccess && (
              <ul className="divide-y">
                {shown.map((choice) => (
                  <li
                    key={planText(choice.plan)}
                    className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-semibold">
                        {planText(choice.plan)}{' '}
                        {choice.current && <Badge variant="secondary">Current</Badge>}
                      </p>
                      {choice.reason && (
                        <p className="text-sm text-muted-foreground">{choice.reason}</p>
                      )}
                    </div>
                    {choice.totalInr !== null && (
                      <p className="shrink-0 font-semibold tabular-nums">
                        from {formatInr(choice.totalInr)}
                      </p>
                    )}
                    {!choice.current && choice.totalInr !== null && (
                      <Button
                        size="sm"
                        disabled={rebuild.isPending}
                        onClick={() => choose(choice.plan)}
                      >
                        Choose
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {plans.isSuccess && ordered.length > SHOWN && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll((was) => !was)}>
                {showAll ? 'Show fewer' : `Show ${ordered.length - SHOWN} more`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

/** "Tokyo 2 nights → Osaka 4 nights". */
function planText(plan: CityPlan): string {
  return plan
    .map((stop) => `${stop.city} ${stop.nights} ${stop.nights === 1 ? 'night' : 'nights'}`)
    .join(' → ');
}

/** Nights between a check-in and a check-out date, both `YYYY-MM-DD`. */
function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round(
    (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000,
  );
}
