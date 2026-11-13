import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { getCityTile } from './city-tiles.ts';
import { createClerkTokenVerifier, createClerkWebhookReader } from './clerk.ts';
import { createSql, isDatabaseReachable } from './db.ts';
import { createDefaultListStore } from './default-lists.ts';
import { loadEnv } from './env.ts';
import { createListStore } from './lists.ts';
import { createLivedCityStore } from './lived-cities.ts';
import { createRatingStore } from './ratings.ts';
import { createVisitStore } from './visits.ts';
import { deleteUserByAuthProviderId, ensureUser, syncUserFromClerk } from './users.ts';

const env = loadEnv();
const sql = createSql(env.DATABASE_URL);
const app = createApp({
  checkDatabase: () => isDatabaseReachable(sql),
  getCityTile: (params) => getCityTile(sql, params),
  corsOrigins: env.CORS_ORIGINS,
  verifyToken: createClerkTokenVerifier(env.CLERK_SECRET_KEY),
  resolveUser: (authProviderId) => ensureUser(sql, authProviderId),
  readWebhook: createClerkWebhookReader(env.CLERK_WEBHOOK_SIGNING_SECRET),
  applyUserEvent: (event) =>
    event.type === 'upsert'
      ? syncUserFromClerk(sql, event.profile)
      : deleteUserByAuthProviderId(sql, event.authProviderId),
  visits: createVisitStore(sql),
  livedCities: createLivedCityStore(sql),
  defaultLists: createDefaultListStore(sql),
  ratings: createRatingStore(sql),
  lists: createListStore(sql),
});

if (!env.CLERK_SECRET_KEY) {
  console.warn(
    'CLERK_SECRET_KEY is not set: every request that needs a signed-in user gets a 401.',
  );
}

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
