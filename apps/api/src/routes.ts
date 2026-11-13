import { Router } from 'express';
import { healthRouter } from './modules/health/health.routes';

// One line per feature module. Mounted under /api by app.ts.
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
