import { Router } from 'express';
import {
  createPackageHandler,
  getPackageCheckHandler,
  getPackageHandler,
} from './holiday-packages.controller';

export const holidayPackagesRouter = Router();

holidayPackagesRouter.post('/', createPackageHandler);
holidayPackagesRouter.get('/:id', getPackageHandler);
holidayPackagesRouter.get('/:id/check', getPackageCheckHandler);
