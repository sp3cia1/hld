import { ErrorState } from '@/components/states/error-state';
import { Loading } from '@/components/states/loading';
import { Motif } from '@/components/motif';
import { Card, CardContent } from '@/components/ui/card';
import { RequestForm } from '../components/request-form';
import { useOptions } from '../hooks';

/** The home page: where a holiday starts. */
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
    </div>
  );
}
