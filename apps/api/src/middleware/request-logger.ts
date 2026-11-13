import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger';

const SAFE_REQUEST_ID = /^[\w.-]{1,128}$/;

/**
 * Gives every request an id (`req.id`), echoes it in the `x-request-id` response header,
 * and logs one line per request: method, path, status, duration, requestId.
 * `req.log` is a child logger that already carries the request id.
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id =
      typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  customLogLevel: (_req, res) => (res.statusCode >= 500 ? 'error' : 'info'),
  serializers: {
    req: (req: { id: string; method: string; url: string }) => ({
      requestId: req.id,
      method: req.method,
      path: req.url,
    }),
    res: (res: { statusCode: number }) => ({ status: res.statusCode }),
  },
});
