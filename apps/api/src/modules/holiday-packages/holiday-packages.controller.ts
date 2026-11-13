import { holidayRequestSchema } from '@bh/shared/holiday-package';
import type { Request, Response } from 'express';
import { createPackage } from './holiday-packages.service';

export async function createPackageHandler(req: Request, res: Response) {
  const request = holidayRequestSchema.parse(req.body);
  const result = await createPackage(request);
  // 201 when a package was saved. NO_PACKAGE saves nothing, so it is a plain 200.
  res.status(result.status === 'NO_PACKAGE' ? 200 : 201).json({ data: result });
}
