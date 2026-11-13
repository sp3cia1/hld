import { Router } from 'express';
import {
  cityPlansHandler,
  createPackageHandler,
  exportPackageHandler,
  getPackageCheckHandler,
  getPackageHandler,
  rebuildPackageHandler,
} from './holiday-packages.controller';

export const holidayPackagesRouter = Router();

holidayPackagesRouter.post('/', createPackageHandler);
holidayPackagesRouter.get('/:id', getPackageHandler);
holidayPackagesRouter.get('/:id/check', getPackageCheckHandler);
holidayPackagesRouter.get('/:id/export', exportPackageHandler);
holidayPackagesRouter.get('/:id/city-plans', cityPlansHandler);
holidayPackagesRouter.post('/:id/rebuild', rebuildPackageHandler);
