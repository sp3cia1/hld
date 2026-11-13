import { Router } from 'express';
import { readQuickRequestHandler } from './quick-request.controller';

export const quickRequestRouter = Router();

quickRequestRouter.post('/', readQuickRequestHandler);
