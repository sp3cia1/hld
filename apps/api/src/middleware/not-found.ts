import type { RequestHandler } from 'express';
import { AppError } from '../lib/app-error';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', 404, `Route ${req.method} ${req.path} not found`));
};
