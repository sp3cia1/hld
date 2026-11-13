import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Empty } from '@/components/states/empty';
import { ErrorState } from '@/components/states/error-state';
import { Loading } from '@/components/states/loading';
import { Button } from '@/components/ui/button';
import { ConfirmPanel } from '@/features/reservations/components/confirm-panel';
import { ApiError } from '@/lib/api-client';
import { formatInr } from '@/lib/format';
import { BudgetSummary } from '../components/budget-summary';
import { DayByDay } from '../components/day-by-day';
import { ExportButton } from '../components/export-button';
import { RulesPanel } from '../components/rules-panel';
import { TripHeading } from '../components/trip-heading';
import { usePackage } from '../hooks';

/** Set by the request form when it opens a package it just built. A change clears it. */
export type PackagePageState = { justBuilt: true } | null;

/**
 * The saved package: total against budget, the rules it passes, confirm and export, then the day-by-day plan with
 * its change controls. Survives a refresh and a shared link.
 */
export function PackagePage() {
  const { id = '' } = useParams();
  const saved = usePackage(id);
  const navigate = useNavigate();
  // "No package fits your budget" is known only for a package as the builder made it: a change can take a package
  // that fits over the budget. The flag lives in the history entry, so it survives a refresh too.
  const justBuilt = (useLocation().state as PackagePageState)?.justBuilt === true;

  if (saved.isPending) return <Loading label="Opening your holiday…" />;
  if (saved.isError) {
    if (saved.error instanceof ApiError && saved.error.code === 'NOT_FOUND') {
      return (
        <Empty
          title="We can't find this holiday"
          description="Check the link, or plan a new holiday."
          action={
            <Button asChild variant="outline">
              <Link to="/">Plan a holiday</Link>
            </Button>
          }
        />
      );
    }
    return <ErrorState error={saved.error} onRetry={() => void saved.refetch()} />;
  }

  const { packageId, trip, budget, status, freeTime, reference } = saved.data.data;
  return (
    <div className="space-y-8">
      <TripHeading title={`Your holiday in ${trip.country}`} trip={trip} />
      {status === 'OVER_BUDGET' && (
        <p role="status" className="rounded-xl bg-caution p-4 text-caution-foreground">
          {justBuilt
            ? `No package fits your budget of ${formatInr(budget.budgetInr)}. This is the cheapest one we can build.`
            : `This holiday is over your budget of ${formatInr(budget.budgetInr)}.`}{' '}
          A budget of {formatInr(budget.totalInr)} would cover it.
        </p>
      )}
      <BudgetSummary budget={budget} />
      <RulesPanel packageId={packageId} />
      <ConfirmPanel saved={saved.data.data} />
      <ExportButton packageId={packageId} />
      <DayByDay
        items={trip.items}
        freeTime={freeTime}
        // A confirmed holiday can't be changed (409 PACKAGE_CONFIRMED), so it shows no change controls.
        changes={
          reference === null
            ? {
                packageId,
                startDate: trip.start_date,
                endDate: trip.end_date,
                onChanged: () => void navigate('.', { replace: true, state: null }),
              }
            : undefined
        }
      />
    </div>
  );
}