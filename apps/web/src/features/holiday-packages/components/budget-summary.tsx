import type { BudgetSummary as Budget } from '@bh/shared/holiday-package';
import { Card, CardContent } from '@/components/ui/card';
import { formatInr } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Total, budget, and the amount left or over (M5). */
export function BudgetSummary({ budget }: { budget: Budget }) {
  const over = budget.leftInr < 0;
  return (
    <Card>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <Figure label="Total" value={formatInr(budget.totalInr)} />
        <Figure label="Your budget" value={formatInr(budget.budgetInr)} />
        <Figure
          label={over ? 'Over budget by' : 'Left'}
          value={formatInr(Math.abs(budget.leftInr))}
          className={cn(over && 'text-destructive')}
        />
      </CardContent>
    </Card>
  );
}

function Figure({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn('text-3xl font-extrabold tabular-nums', className)}>{value}</p>
    </div>
  );
}
