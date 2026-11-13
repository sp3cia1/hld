import type * as React from 'react';
import { cn } from '@/lib/utils';

/** The browser's own `<select>`, styled like `Input`. Keyboard, screen readers and phones work as the browser does. */
export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
