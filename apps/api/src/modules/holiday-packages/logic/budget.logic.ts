import type { BudgetSummary, Trip } from '@bh/shared/holiday-package';

/** The total against the budget (M5). `leftInr` is negative when the package is over budget. */
export function budgetOf(trip: Pick<Trip, 'budget_inr' | 'total_inr'>): BudgetSummary {
  return {
    budgetInr: trip.budget_inr,
    totalInr: trip.total_inr,
    leftInr: trip.budget_inr - trip.total_inr,
  };
}