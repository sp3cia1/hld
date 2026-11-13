import { confirmRequestSchema } from '@bh/shared/reservation';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { confirmPackage, getReservation } from './reservations.service';

const reservationParamsSchema = z.object({ reference: z.string().min(1) });

export async function confirmPackageHandler(req: Request, res: Response) {
  const { packageId } = confirmRequestSchema.parse(req.body);
  const { reservation, created } = await confirmPackage(packageId);
  // 201 for a new reservation. Confirming again returns the same reservation with 200.
  res.status(created ? 201 : 200).json({ data: reservation });
}

export async function getReservationHandler(req: Request, res: Response) {
  const { reference } = reservationParamsSchema.parse(req.params);
  res.json({ data: await getReservation(reference) });
}