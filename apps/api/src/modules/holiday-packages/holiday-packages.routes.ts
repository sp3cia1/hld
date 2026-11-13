import { Router } from 'express';
import { createPackageHandler, getPackageHandler } from './holiday-packages.controller';

export const holidayPackagesRouter = Router();

holidayPackagesRouter.post('/', createPackageHandler);
holidayPackagesRouter.get('/:id', getPackageHandler);
