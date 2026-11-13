import type { ReactNode } from 'react';

type EmptyProps = {
  title: string;
  description?: string;
  /** Usually a button that helps the customer recover, e.g. "Clear filters". */
  action?: ReactNode;
};

export function Empty({ title, description, action }: EmptyProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      {/* Empty states carry their own small cloud ("nothing here yet"), so pages never add one. */}
      <svg aria-hidden viewBox="0 0 120 64" className="mb-2 h-12 w-24 text-foreground">
        <path
          d="M24 56H96A14 14 0 0 0 96 28A26 26 0 0 0 44 30A16 16 0 0 0 24 56Z"
          fill="var(--card)"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
      <h2>{title}</h2>
      {description && <p className="max-w-md text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
