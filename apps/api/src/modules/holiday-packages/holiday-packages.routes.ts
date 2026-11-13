import { Router } from 'express';
import {
  createPackageHandler,
  exportPackageHandler,
  getPackageCheckHandler,
  getPackageHandler,
} from './holiday-packages.controller';

export const holidayPackagesRouter = Router();

holidayPackagesRouter.post('/', createPackageHandler);
holidayPackagesRouter.get('/:id', getPackageHandler);
holidayPackagesRouter.get('/:id/check', getPackageCheckHandler);
holidayPackagesRouter.get('/:id/export', exportPackageHandler);
