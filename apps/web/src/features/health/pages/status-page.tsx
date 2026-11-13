import { ErrorState } from '@/components/states/error-state';
import { Loading } from '@/components/states/loading';
import { useHealth } from '../hooks';

/** Debug page: shows whether the browser can reach the API and the API can reach the database. */
export function StatusPage() {
  const health = useHealth();

  if (health.isPending) return <Loading label="Checking the API…" />;
  if (health.isError)
    return <ErrorState error={health.error} onRetry={() => void health.refetch()} />;

  return (
    <div>
      <h1>System status</h1>
      <p className="mt-2 text-muted-foreground">API and database: {health.data.data.status}</p>
    </div>
  );
}
