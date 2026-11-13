import type { Request, Response } from 'express';
import { getOptions } from './options.service';

export function getOptionsHandler(_req: Request, res: Response) {
  res.json({ data: getOptions() });
}
