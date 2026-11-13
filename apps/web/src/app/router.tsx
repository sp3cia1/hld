import { createBrowserRouter } from 'react-router';
import { Empty } from '@/components/states/empty';
import { StatusPage } from '@/features/health/pages/status-page';
import { PackagePage } from '@/features/holiday-packages/pages/package-page';
import { RequestPage } from '@/features/holiday-packages/pages/request-page';
import { ReservationPage } from '@/features/reservations/pages/reservation-page';
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
          { path: '/', element: <RequestPage /> },
          { path: '/packages/:id', element: <PackagePage /> },
                    { path: '/reservations/:reference', element: <ReservationPage /> },
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
