import type { SavedPackage } from '@bh/shared/holiday-package';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/error-messages';
import { formatInr } from '@/lib/format';
import { useConfirmPackage } from '../hooks';

/** Confirm (M7): books the package and opens its reservation. Once it is booked, shows the number instead. */
export function ConfirmPanel({ saved }: { saved: SavedPackage }) {
  const navigate = useNavigate();
  const confirm = useConfirmPackage();

  if (saved.reference) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Booked. Your reservation number</p>
            <p className="text-2xl font-extrabold tracking-wider tabular-nums">{saved.reference}</p>
          </div>
          <Button asChild variant="outline">
            <Link to={`/reservations/${saved.reference}`}>Open the reservation</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const over = saved.budget.leftInr < 0;
  return (
    <Card>
      <CardContent className="space-y-3">
        <h2>Ready to book?</h2>
        <p className="text-muted-foreground">
          Confirming books this holiday and gives you a 10-digit reservation number. A booked
          holiday can’t be changed.
        </p>
        {over && (
          <p className="w-fit rounded-md bg-caution px-2 py-1 text-sm text-caution-foreground">
            This holiday is {formatInr(-saved.budget.leftInr)} over your budget. You can still book
            it.
          </p>
        )}
        {confirm.isError && (
          <p role="alert" className="text-sm text-destructive">
            {getErrorMessage(confirm.error)}
          </p>
        )}
        <Button
          disabled={confirm.isPending}
          onClick={() =>
            confirm.mutate(
              { packageId: saved.packageId },
              { onSuccess: ({ data }) => void navigate(`/reservations/${data.reference}`) },
            )
          }
        >
          {confirm.isPending ? 'Booking…' : 'Confirm and book'}
        </Button>
      </CardContent>
    </Card>
  );
}