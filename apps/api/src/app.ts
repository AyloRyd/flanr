import { Hono } from 'hono';
import type { HealthResponse } from '@flanr/shared';

export interface AppDependencies {
  checkDatabase: () => Promise<boolean>;
}

export function createApp({ checkDatabase }: AppDependencies) {
  const app = new Hono();

  app.get('/health', async (c) => {
    const databaseOk = await checkDatabase();
    const body: HealthResponse = {
      status: databaseOk ? 'ok' : 'unavailable',
      database: databaseOk ? 'ok' : 'unavailable',
    };
    return c.json(body, databaseOk ? 200 : 503);
  });

  return app;
}
