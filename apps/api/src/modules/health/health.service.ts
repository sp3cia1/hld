import { AppError } from '../../lib/app-error';
import { pingDatabase } from './health.repository';

export async function getHealth() {
  try {
    await pingDatabase();
  } catch (cause) {
    // 503 = a dependency is down. The cause is logged by the error middleware, not sent to the client.
    throw new AppError('SERVICE_UNAVAILABLE', 503, 'Database is unavailable', undefined, { cause });
  }
  return { status: 'ok' as const };
}
