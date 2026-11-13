import { Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/error-messages';
import { usePackageCheck } from '../hooks';

/**
 * The travel rules (§4) checked against this package by the validator, which is separate from the builder.
 * One line when every rule passes, opening to list them all. When a rule fails it opens by itself, with the reason.
 */
export function RulesPanel({ packageId }: { packageId: string }) {
  const check = usePackageCheck(packageId);

  if (check.isPending) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Checking the travel rules…
      </p>
    );
  }
  if (check.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {getErrorMessage(check.error)}{' '}
        <button
          type="button"
          className="rounded-sm underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => void check.refetch()}
        >
          Try again
        </button>
      </p>
    );
  }

  const { rules, problems } = check.data.data;
  const failing = rules.filter((rule) => !rule.passed).length;

  return (
    <Card>
      <CardContent>
        <details open={failing > 0} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2 font-semibold">
              {failing === 0 ? (
                <Check aria-hidden className="size-5 text-primary" />
              ) : (
                <X aria-hidden className="size-5 text-destructive" />
              )}
              {failing === 0
                ? `All ${rules.length} travel rules pass`
                : `${failing} of ${rules.length} travel rules fail`}
            </span>
            <span className="text-sm text-muted-foreground group-open:hidden">Show the rules</span>
            <span className="hidden text-sm text-muted-foreground group-open:inline">Hide</span>
          </summary>

          <ul className="mt-4 space-y-3">
            {rules.map((rule) => (
              <li key={rule.id} className="flex gap-3 text-sm">
                {rule.passed ? (
                  <Check aria-label="Passes" className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <X aria-label="Fails" className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <div className="space-y-1">
                  <p>{rule.title}</p>
                  {problems
                    .filter((problem) => problem.rule === rule.id)
                    .map((problem, index) => (
                      <p key={`${problem.itemId ?? 'trip'}-${index}`} className="text-destructive">
                        {problem.message}
                      </p>
                    ))}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Checked by a validator written from the travel rules, separate from the code that builds
            the holiday.
          </p>
        </details>
      </CardContent>
    </Card>
  );
}
