import { Router } from 'express';
import { healthRouter } from './modules/health/health.routes';
import { holidayPackagesRouter } from './modules/holiday-packages/holiday-packages.routes';
import { optionsRouter } from './modules/options/options.routes';
import { packageChangesRouter } from './modules/package-changes/package-changes.routes';
import { reservationsRouter } from './modules/reservations/reservations.routes';

// One line per feature module. Mounted under /api by app.ts.
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/packages', holidayPackagesRouter);
apiRouter.use('/packages', packageChangesRouter);
apiRouter.use('/options', optionsRouter);
apiRouter.use('/reservations', reservationsRouter);
