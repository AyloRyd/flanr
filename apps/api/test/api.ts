import { createApiClient, type ApiClient } from '@flanr/shared';
import { createApp } from '../src/app.ts';
import type { Sql } from '../src/db.ts';
import { createDefaultListStore } from '../src/default-lists.ts';
import { createLivedCityStore } from '../src/lived-cities.ts';
import { createRatingStore } from '../src/ratings.ts';
import { ensureUser } from '../src/users.ts';
import { createVisitStore } from '../src/visits.ts';

/** The time every API test runs at: noon on 12 November 2026. */
export const testNow = () => new Date('2026-11-12T12:00:00Z');

/**
 * The app on the test database, used through the generated client.
 * The session token `<name>-token` signs in the user with the Clerk ID `clerk_<name>`.
 */
export function createTestApi(sql: Sql): { clientFor: (token: string | null) => ApiClient } {
  const app = createApp({
    checkDatabase: async () => true,
    getCityTile: async () => null,
    corsOrigins: [],
    verifyToken: async (token) => {
      const name = /^(\w+)-token$/.exec(token)?.[1];
      return name ? `clerk_${name}` : null;
    },
    resolveUser: (authProviderId) => ensureUser(sql, authProviderId),
    readWebhook: async () => null,
    applyUserEvent: async () => {},
    visits: createVisitStore(sql),
    livedCities: createLivedCityStore(sql),
    defaultLists: createDefaultListStore(sql),
    ratings: createRatingStore(sql),
    now: testNow,
    writeRateLimit: { limit: 10_000, windowMs: 60_000 },
  });
  return {
    clientFor: (token) =>
      createApiClient({
        baseUrl: 'http://api.test',
        fetch: async (request) => app.fetch(request),
        getToken: async () => token,
      }),
  };
}

/** Empties the user and city data and adds Germany, so tests can insert cities. */
export async function resetData(sql: Sql): Promise<void> {
  await sql`TRUNCATE users, city_tile_shapes, city_names, cities, municipalities, regions, countries RESTART IDENTITY CASCADE`;
  await sql`INSERT INTO countries (code, name_local, name_en) VALUES ('DE', 'Deutschland', 'Germany')`;
}

export async function insertCity(sql: Sql, id: number, name: string): Promise<void> {
  await sql`
    INSERT INTO cities (id, osm_type, osm_id, name_local, name_en, country_code, settlement_type, centre)
    OVERRIDING SYSTEM VALUE
    VALUES (${id}, 'node', ${id}, ${name}, ${name}, 'DE', 'city', ST_SetSRID(ST_MakePoint(7, 51), 4326))`;
}

/** Creates the user `clerk_<name>` with the given registration time. */
export async function registerUser(sql: Sql, name: string, registeredAt: string): Promise<void> {
  const user = await ensureUser(sql, `clerk_${name}`);
  await sql`UPDATE users SET registered_at = ${registeredAt} WHERE id = ${user.id}`;
}
