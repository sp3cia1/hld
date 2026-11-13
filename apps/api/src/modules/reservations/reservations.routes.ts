import { Router } from 'express';
import { confirmPackageHandler, getReservationHandler } from './reservations.controller';

export const reservationsRouter = Router();

reservationsRouter.post('/', confirmPackageHandler);
reservationsRouter.get('/:reference', getReservationHandler);