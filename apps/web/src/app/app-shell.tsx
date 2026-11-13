import { Link, Outlet } from 'react-router';

export function AppShell() {
  return (
    // `isolate` keeps page motifs (components/motif.tsx) behind the content; `overflow-x-clip` crops them at the edge.
    <div className="relative isolate min-h-screen overflow-x-clip">
      <header>
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4">
          <Link
            to="/"
            className="rounded-sm text-sm font-extrabold tracking-widest uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Build My Holiday
          </Link>
        </div>
      </header>
      <main className="relative mx-auto max-w-5xl px-4 pt-4 pb-16">
        <Outlet />
      </main>
    </div>
  );
}
