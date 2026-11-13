import { ErrorState } from '@/components/states/error-state';
import { Loading } from '@/components/states/loading';
import { Motif } from '@/components/motif';
import { Card, CardContent } from '@/components/ui/card';
import { LookupForm } from '@/features/reservations/components/lookup-form';
import { RequestForm } from '../components/request-form';
import { useOptions } from '../hooks';

/** The home page: where a holiday starts, and where a booked one is found again. */
export function RequestPage() {
  const options = useOptions();

  if (options.isError) {
    return <ErrorState error={options.error} onRetry={() => void options.refetch()} />;
  }
  return (
    <div className="space-y-6">
      <Motif kind="sun" />
      <div className="space-y-2">
        <h1>Plan your holiday</h1>
        <p className="text-muted-foreground">
          Tell us where and when. We choose the cities and build the whole trip.
        </p>
      </div>
      {options.isPending ? (
        <Loading label="Loading destinations…" />
      ) : (
        // The request form is this page's search panel, so it always carries the lift.
        <Card className="shadow-lift">
          <CardContent className="p-5">
            <RequestForm options={options.data.data} />
          </CardContent>
        </Card>
      )}
      <section className="space-y-3 pt-4">
        <h2>Already booked?</h2>
        <LookupForm />
      </section>
    </div>
  );
}