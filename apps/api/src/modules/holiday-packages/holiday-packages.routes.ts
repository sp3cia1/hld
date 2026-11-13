import { Router } from 'express';
import { createPackageHandler } from './holiday-packages.controller';

export const holidayPackagesRouter = Router();

holidayPackagesRouter.post('/', createPackageHandler);
