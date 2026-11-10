import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { createSql, isDatabaseReachable } from './db.ts';
import { loadEnv } from './env.ts';

const env = loadEnv();
const sql = createSql(env.DATABASE_URL);
const app = createApp({ checkDatabase: () => isDatabaseReachable(sql) });

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
