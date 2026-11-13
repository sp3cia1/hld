import { Router } from 'express';
import {
  attractionChoicesHandler,
  changeHandler,
  flightChoicesHandler,
  hotelChoicesHandler,
} from './package-changes.controller';

// Mounted at /packages next to the holiday-packages router. Its `/:id` matches one path segment only, so these
// longer paths never reach it.
export const packageChangesRouter = Router();

packageChangesRouter.get('/:id/choices/hotel', hotelChoicesHandler);
packageChangesRouter.get('/:id/choices/flight', flightChoicesHandler);
packageChangesRouter.get('/:id/choices/attraction', attractionChoicesHandler);
packageChangesRouter.post('/:id/changes', changeHandler);
