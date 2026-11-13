import { holidayRequestSchema, rebuildRequestSchema } from '@bh/shared/holiday-package';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createPackage,
  exportPackage,
  getCityPlans,
  getPackage,
  getPackageCheck,
  rebuildPackage,
} from './holiday-packages.service';

const packageParamsSchema = z.object({ id: z.string().min(1) });

export async function createPackageHandler(req: Request, res: Response) {
  const request = holidayRequestSchema.parse(req.body);
  const result = await createPackage(request);
  // 201 when a package was saved. NO_PACKAGE saves nothing, so it is a plain 200.
  res.status(result.status === 'NO_PACKAGE' ? 200 : 201).json({ data: result });
}

export async function getPackageHandler(req: Request, res: Response) {
  const { id } = packageParamsSchema.parse(req.params);
  res.json({ data: await getPackage(id) });
}

export async function getPackageCheckHandler(req: Request, res: Response) {
  const { id } = packageParamsSchema.parse(req.params);
  res.json({ data: await getPackageCheck(id) });
}

export async function exportPackageHandler(req: Request, res: Response) {
  const { id } = packageParamsSchema.parse(req.params);
  res.json({ data: await exportPackage(id) });
}

export async function cityPlansHandler(req: Request, res: Response) {
  const { id } = packageParamsSchema.parse(req.params);
  res.json({ data: await getCityPlans(id) });
}

export async function rebuildPackageHandler(req: Request, res: Response) {
  const { id } = packageParamsSchema.parse(req.params);
  const { cityPlan } = rebuildRequestSchema.parse(req.body);
  const result = await rebuildPackage(id, cityPlan);
  res.status(result.status === 'NO_PACKAGE' ? 200 : 201).json({ data: result });
}
