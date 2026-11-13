import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/app-error';

/** The one place that turns any thrown value into `{ error: { code, message, details?, requestId } }`. */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  const appError = toAppError(err);

  // Log the original error so the stack survives. The client only sees the generic AppError.
  if (appError.httpStatus >= 500) req.log.error({ err }, 'request failed');

  res.status(appError.httpStatus).json({
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details,
      requestId: req.id,
    },
  });
};

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    const fields = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return new AppError('VALIDATION_ERROR', 400, 'Some fields are invalid', { fields });
  }
  // express.json() throws this when the body is not valid JSON.
  if (err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed') {
    return new AppError('INVALID_JSON', 400, 'Request body is not valid JSON');
  }
  return new AppError('INTERNAL', 500, 'Something went wrong');
}
