import {
  changeRequestSchema,
  flightChoicesQuerySchema,
  hotelChoicesQuerySchema,
} from '@bh/shared/package-change';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { applyChange, getFlightChoices, getHotelChoices } from './package-changes.service';

const packageParamsSchema = z.object({ id: z.string().min(1) });

export async function hotelChoicesHandler(req: Request, res: Response) {
  const { id } = packageParamsSchema.parse(req.params);
  const { city } = hotelChoicesQuerySchema.parse(req.query);
  res.json({ data: await getHotelChoices(id, city) });
}

export async function flightChoicesHandler(req: Request, res: Response) {
  const { id } = packageParamsSchema.parse(req.params);
  const { direction } = flightChoicesQuerySchema.parse(req.query);
  res.json({ data: await getFlightChoices(id, direction) });
}

export async function changeHandler(req: Request, res: Response) {
  const { id } = packageParamsSchema.parse(req.params);
  const change = changeRequestSchema.parse(req.body);
  // REFUSED is a 200 as well: a valid answer to a valid request, like NO_PACKAGE when building.
  res.json({ data: await applyChange(id, change) });
}
