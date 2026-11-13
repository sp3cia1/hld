import { quickRequestSchema } from '@bh/shared/quick-request';
import type { Request, Response } from 'express';
import { readQuickRequest } from './quick-request.service';

export function readQuickRequestHandler(req: Request, res: Response) {
  const { text } = quickRequestSchema.parse(req.body);
  // Nothing is saved: the answer only fills the form, and the traveler still clicks Build.
  res.json({ data: readQuickRequest(text) });
}
