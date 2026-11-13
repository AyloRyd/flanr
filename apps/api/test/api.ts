import { createApiClient, type ApiClient } from '@flanr/shared';
import { createAccountStore } from '../src/accounts.ts';
import { createApp } from '../src/app.ts';
import { createCitySearch } from '../src/city-search.ts';
import type { Sql } from '../src/db.ts';
import { createDefaultListStore } from '../src/default-lists.ts';
import { createListStore } from '../src/lists.ts';
import { createLivedCityStore } from '../src/lived-cities.ts';
import { createRatingStore } from '../src/ratings.ts';
import { createProfileStore, ensureUser } from '../src/users.ts';
import { createVisitStore } from '../src/visits.ts';

/** The time every API test runs at: noon on 12 November 2026. */
export const testNow = () => new Date('2026-11-12T12:00:00Z');

/** The sign-in provider of the tests fails to delete the account with this ID. */
export const unremovableAuthAccount = 'clerk_stuck';

export interface TestApi {
  clientFor: (token: string | null) => ApiClient;
  /** The IDs of the accounts that were deleted at the sign-in provider, oldest first. */
  removedAuthAccounts: string[];
}

/**
 * The app on the test database, used through the generated client.
 * The session token `<name>-token` signs in the user with the Clerk ID `clerk_<name>`.
 */
export function createTestApi(sql: Sql): TestApi {
  const removedAuthAccounts: string[] = [];
  const app = createApp({
    checkDatabase: async () => true,
    getCityTile: async () => null,
    searchCities: createCitySearch(sql),
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
    lists: createListStore(sql),
    profiles: createProfileStore(sql),
    accounts: createAccountStore(sql, async (authProviderId) => {
      if (authProviderId === unremovableAuthAccount) throw new Error('Provider is down');
      removedAuthAccounts.push(authProviderId);
    }),
    now: testNow,
    writeRateLimit: { limit: 10_000, windowMs: 60_000 },
  });
  return {
    removedAuthAccounts,
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

/** The criteria of migration 0013. They are not user data, so resetData keeps them. */
export const initialCriteria = [
  { key: 'architecture', name: 'Architecture' },
  { key: 'urbanism', name: 'Urbanism' },
  { key: 'greenery', name: 'Greenery' },
  { key: 'public_transport', name: 'Public transport' },
  { key: 'safety', name: 'Safety' },
  { key: 'cleanliness', name: 'Cleanliness' },
];

/** Undoes what a test did to the criteria. Call it after resetData, which removes the ratings. */
export async function resetCriteria(sql: Sql): Promise<void> {
  await sql`DELETE FROM criteria WHERE key <> ALL(${initialCriteria.map(({ key }) => key)})`;
  for (const [index, { key, name }] of initialCriteria.entries()) {
    await sql`
      UPDATE criteria SET name = ${name}, active = true, sort_order = ${(index + 1) * 10}
      WHERE key = ${key}`;
  }
}
