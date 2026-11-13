import { buildResultSchema, type Trip } from '@bh/shared/holiday-package';
import { Link, useLocation, useParams } from 'react-router';
import { Empty } from '@/components/states/empty';
import { Button } from '@/components/ui/button';
import { formatInr, formatList, formatLocalDate } from '@/lib/format';
import { BudgetSummary } from '../components/budget-summary';
import { DayByDay } from '../components/day-by-day';

/**
 * The built package: total against budget, then the day-by-day plan.
 * The request form hands the result over in the history entry, because the API can't fetch a package by id yet.
 */
export function PackagePage() {
  const { id } = useParams();
  const parsed = buildResultSchema.safeParse(useLocation().state);

  if (!parsed.success || parsed.data.status === 'NO_PACKAGE' || parsed.data.packageId !== id) {
    return (
      <Empty
        title="This package isn't open here"
        description="A package can only be opened right after it is built for now. Build it again from the form."
        action={
          <Button asChild variant="outline">
            <Link to="/">Plan a holiday</Link>
          </Button>
        }
      />
    );
  }

  const { trip, budget, status } = parsed.data;
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
