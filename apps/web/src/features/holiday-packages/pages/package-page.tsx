import type { Trip } from '@bh/shared/holiday-package';
import { Link, useParams } from 'react-router';
import { Empty } from '@/components/states/empty';
import { ErrorState } from '@/components/states/error-state';
import { Loading } from '@/components/states/loading';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { formatInr, formatList, formatLocalDate } from '@/lib/format';
import { BudgetSummary } from '../components/budget-summary';
import { DayByDay } from '../components/day-by-day';
import { usePackage } from '../hooks';

/** The saved package: total against budget, then the day-by-day plan. Survives a refresh and a shared link. */
export function PackagePage() {
  const { id = '' } = useParams();
  const saved = usePackage(id);

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

  const { trip, budget, status } = saved.data.data;
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1>Your holiday in {trip.country}</h1>
        <p className="text-muted-foreground">
          {formatLocalDate(trip.start_date)} to {formatLocalDate(trip.end_date)} · from{' '}
          {trip.traveler.home_airport} · {travelers(trip.traveler)}
        </p>
      </div>
      {status === 'OVER_BUDGET' && (
        <p role="status" className="rounded-xl bg-caution p-4 text-caution-foreground">
          No package fits your budget of {formatInr(budget.budgetInr)}. This is the cheapest one we
          can build. A budget of {formatInr(budget.totalInr)} would cover it.
        </p>
      )}
      <BudgetSummary budget={budget} />
      <DayByDay items={trip.items} />
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
