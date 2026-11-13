import { Router } from 'express';
import { getOptionsHandler } from './options.controller';

export const optionsRouter = Router();

optionsRouter.get('/', getOptionsHandler);
