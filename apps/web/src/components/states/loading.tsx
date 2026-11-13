import { Loader2 } from 'lucide-react';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-16 text-muted-foreground"
    >
      <Loader2 className="size-5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
