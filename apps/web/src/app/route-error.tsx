import { useRouteError } from 'react-router';
import { ErrorState } from '@/components/states/error-state';

/** Shown when a page throws while rendering. Keeps the header and never shows a stack trace. */
export function RouteError() {
  const error = useRouteError();
  return <ErrorState error={error} onRetry={() => window.location.reload()} />;
}
