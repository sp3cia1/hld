import { holidayRequestSchema } from '@bh/shared/holiday-package';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { createPackage, getPackage } from './holiday-packages.service';

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
