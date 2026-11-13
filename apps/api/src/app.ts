import express from 'express';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';
import { requestLogger } from './middleware/request-logger';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
