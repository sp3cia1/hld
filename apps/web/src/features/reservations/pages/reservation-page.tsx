import { useParams } from 'react-router';
import { Motif } from '@/components/motif';
import { Empty } from '@/components/states/empty';
import { ErrorState } from '@/components/states/error-state';
import { Loading } from '@/components/states/loading';
import { Card, CardContent } from '@/components/ui/card';
import { BudgetSummary } from '@/features/holiday-packages/components/budget-summary';
import { DayByDay } from '@/features/holiday-packages/components/day-by-day';
import { TripHeading } from '@/features/holiday-packages/components/trip-heading';
import { ApiError } from '@/lib/api-client';
import { LookupForm } from '../components/lookup-form';
import { useReservation } from '../hooks';

/** The reservation summary (M7): read-only, from the snapshot saved at confirm. Opens after a backend restart too. */
export function ReservationPage() {
  const { reference = '' } = useParams();
  const reservation = useReservation(reference);

  if (reservation.isPending) return <Loading label="Opening your reservation…" />;
  if (reservation.isError) {
    if (reservation.error instanceof ApiError && reservation.error.code === 'NOT_FOUND') {
      return (
        <Empty
          title="We can't find a reservation with this number"
          description="Check the 10 digits and try again."
          action={<LookupForm />}
        />
      );
    }
    return <ErrorState error={reservation.error} onRetry={() => void reservation.refetch()} />;
  }

  const { trip, budget } = reservation.data.data;
  return (
    <div className="space-y-8">
      <Motif kind="stamp" label="Booked" />
      <TripHeading title={`Your holiday in ${trip.country} is booked`} trip={trip} />
      <Card>
        <CardContent className="space-y-1">
          <p className="text-sm text-muted-foreground">Reservation number</p>
          <p className="text-4xl font-extrabold tracking-wider tabular-nums">
            {reservation.data.data.reference}
          </p>
          <p className="text-sm text-muted-foreground">Keep it to open this holiday again.</p>
        </CardContent>
      </Card>
      <BudgetSummary budget={budget} />
            {/* A booked holiday is read-only, so it offers no free-time suggestions. */}
      <DayByDay items={trip.items} freeTime={[]} />
    </div>
  );
}