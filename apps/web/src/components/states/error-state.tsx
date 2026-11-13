import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/error-messages';

type ErrorStateProps = {
  error: unknown;
  /** Shown as a "Try again" button, e.g. `() => void query.refetch()`. */
  onRetry?: () => void;
};

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
      <h2>{getErrorMessage(error)}</h2>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
      {requestId && <p className="text-xs text-muted-foreground">Reference: {requestId}</p>}
    </div>
  );
}
