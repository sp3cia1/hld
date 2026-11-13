import type { Request, Response } from 'express';
import { getHealth } from './health.service';

export async function getHealthHandler(_req: Request, res: Response) {
  res.json({ data: await getHealth() });
}
