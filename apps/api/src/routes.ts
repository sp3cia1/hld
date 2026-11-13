import { Router } from 'express';
import { healthRouter } from './modules/health/health.routes';
import { holidayPackagesRouter } from './modules/holiday-packages/holiday-packages.routes';
import { optionsRouter } from './modules/options/options.routes';

// One line per feature module. Mounted under /api by app.ts.
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/packages', holidayPackagesRouter);
apiRouter.use('/options', optionsRouter);
