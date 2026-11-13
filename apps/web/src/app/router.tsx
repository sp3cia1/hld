import { createBrowserRouter } from 'react-router';
import { Empty } from '@/components/states/empty';
import { StatusPage } from '@/features/health/pages/status-page';
import { AppShell } from './app-shell';
import { RouteError } from './route-error';

// One route per page. Feature pages live in features/<feature>/pages.
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      {
        // Pathless route: a page that crashes shows RouteError inside the shell, not a blank screen.
        errorElement: <RouteError />,
        children: [
          // The status page stands in for the home page until the request form exists.
          { path: '/', element: <StatusPage /> },
          { path: '/status', element: <StatusPage /> },
          {
            path: '*',
            element: (
              <Empty title="Page not found" description="Check the address and try again." />
            ),
          },
        ],
      },
    ],
  },
]);
