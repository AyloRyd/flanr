import { dataExportSchema } from '@flanr/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import {
  createTestApi,
  insertCity,
  registerUser,
  resetCriteria,
  resetData,
  testNow,
} from './api.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);
const [wuppertal, aachen, bonn] = [1, 2, 3];

const { clientFor, removedAuthAccounts } = createTestApi(sql);
const ada = clientFor('ada-token');
const bob = clientFor('bob-token');
const stuck = clientFor('stuck-token');
type Client = typeof ada;

const city = (cityId: number) => ({ params: { path: { cityId } } });

/** A visit and a rating in Wuppertal, Bonn as home, Aachen planned, and a list with Aachen. */
async function fillAccount(client: Client) {
  await client.POST('/v1/visits', { body: { cityId: wuppertal, date: '2026-05-10' } });
  await client.PUT('/v1/cities/{cityId}/rating', {
    ...city(wuppertal),
    body: { subjective: 8, criteria: { public_transport: 10 } },
  });
  await client.PUT('/v1/lived-cities/{cityId}', {
    ...city(bonn),
    body: { isCurrent: true, from: '2024' },
  });
  await client.PUT('/v1/planned-cities/{cityId}', city(aachen));
  const { data: list } = await client.POST('/v1/lists', { body: { title: 'Trams' } });
  await client.POST('/v1/lists/{listId}/entries', {
    params: { path: { listId: list?.id ?? 0 } },
    body: { cityId: aachen, note: 'Printen' },
  });
}

const deleteAccount = (client: Client) =>
  client.DELETE('/v1/me', { params: { query: { confirm: 'true' } } });

const userTables = [
  'visits',
  'lived_cities',
  'planned_cities',
  'city_ratings',
  'criterion_ratings',
  'lists',
  'list_entries',
];
const rowsOf = async (userName: string) => {
  const counts: Record<string, number> = {};
  for (const table of userTables) {
    const owner = table === 'list_entries' ? sql`lists.user_id` : sql`user_id`;
    const from =
      table === 'list_entries'
        ? sql`list_entries JOIN lists ON lists.id = list_entries.list_id`
        : sql(table);
    const [row] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM ${from}
      WHERE ${owner} = (SELECT id FROM users WHERE auth_provider_id = ${`clerk_${userName}`})`;
    counts[table] = row?.count ?? 0;
  }
  return counts;
};
const nothing = Object.fromEntries(userTables.map((table) => [table, 0]));

beforeEach(async () => {
  await resetData(sql);
  await resetCriteria(sql);
  removedAuthAccounts.length = 0;
  await insertCity(sql, wuppertal, 'Wuppertal');
  await insertCity(sql, aachen, 'Aachen');
  await insertCity(sql, bonn, 'Bonn');
  for (const name of ['ada', 'bob', 'stuck']) {
    await registerUser(sql, name, '2026-03-01T10:00:00Z');
  }
});
afterAll(async () => {
  await sql.end();
});

describe('DELETE /v1/me (FR-AUTH-009, SRS 5.4)', () => {
  it('deletes the profile and everything the user stored', async () => {
    await fillAccount(ada);
    const username = (await ada.GET('/v1/me')).data?.username ?? '';

    const { response } = await deleteAccount(ada);

    expect(response.status).toBe(204);
    expect(await sql`SELECT 1 FROM users WHERE auth_provider_id = 'clerk_ada'`).toHaveLength(0);
    for (const table of userTables) {
      expect(await sql`SELECT 1 FROM ${sql(table)}`, table).toHaveLength(0);
    }
    const profile = await bob.GET('/v1/users/{username}', { params: { path: { username } } });
    expect(profile.response.status).toBe(404);
  });

  it('deletes the account at the sign-in provider, so the user can no longer sign in', async () => {
    await deleteAccount(ada);

    expect(removedAuthAccounts).toEqual(['clerk_ada']);
  });

  it('takes the ratings of the user out of the community rating', async () => {
    await fillAccount(ada);
    await bob.POST('/v1/visits', { body: { cityId: wuppertal, date: '2026-06-01' } });
    await bob.PUT('/v1/cities/{cityId}/rating', { ...city(wuppertal), body: { subjective: 5 } });
    const before = await bob.GET('/v1/cities/{cityId}/community-rating', city(wuppertal));

    await deleteAccount(ada);

    const after = await bob.GET('/v1/cities/{cityId}/community-rating', city(wuppertal));
    expect(before.data).toMatchObject({ average: 6.5, count: 2 });
    expect(after.data).toMatchObject({ average: 5, count: 1 });
  });

  it('leaves the data of other users alone (NFR-SEC-003)', async () => {
    await fillAccount(ada);
    await fillAccount(bob);
    const before = await rowsOf('bob');

    await deleteAccount(ada);

    expect(await rowsOf('bob')).toEqual(before);
    expect(before).not.toEqual(nothing);
  });

  it('deletes nothing without the confirmation', async () => {
    await fillAccount(ada);

    // The typed client does not allow leaving the confirmation out.
    const { response } = await ada.DELETE('/v1/me', { params: { query: {} } } as never);

    expect(response.status).toBe(400);
    expect(removedAuthAccounts).toEqual([]);
    expect(await rowsOf('ada')).not.toEqual(nothing);
  });

  it('deletes nothing when the sign-in provider fails', async () => {
    await fillAccount(stuck);

    const { error, response } = await deleteAccount(stuck);

    expect(response.status).toBe(502);
    expect(error).toMatchObject({ status: 502, title: 'Account not deleted' });
    expect(await rowsOf('stuck')).not.toEqual(nothing);
  });

  it('needs a signed-in user', async () => {
    const { response } = await deleteAccount(clientFor(null));

    expect(response.status).toBe(401);
    expect(await sql`SELECT 1 FROM users`).toHaveLength(3);
  });
});

describe('GET /v1/me/export (NFR-GDPR-003)', () => {
  it('returns everything the user stored, as one JSON document', async () => {
    await fillAccount(ada);

    const { data, response } = await ada.GET('/v1/me/export');

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('Content-Disposition')).toContain('flanr-export.json');
    expect(dataExportSchema.safeParse(data).success).toBe(true);
    expect(data).toMatchObject({
      exportedAt: testNow().toISOString(),
      profile: { homeCityId: bonn },
      visits: [{ cityId: wuppertal, date: '2026-05-10' }],
      livedCities: [{ cityId: bonn, isCurrent: true, from: '2024', to: null }],
      plannedCities: [{ cityId: aachen }],
      ratings: [{ cityId: wuppertal, subjective: 8, criteria: { public_transport: 10 } }],
      lists: [{ title: 'Trams', entries: [{ cityId: aachen, position: 1, note: 'Printen' }] }],
    });
  });

  it('says which cities the IDs stand for', async () => {
    await fillAccount(ada);

    const { data } = await ada.GET('/v1/me/export');

    expect(data?.cities).toEqual([
      { id: wuppertal, name: 'Wuppertal', countryCode: 'DE', osm: 'node/1', wikidataId: null },
      { id: aachen, name: 'Aachen', countryCode: 'DE', osm: 'node/2', wikidataId: null },
      { id: bonn, name: 'Bonn', countryCode: 'DE', osm: 'node/3', wikidataId: null },
    ]);
  });

  it('is complete past one page of visits', async () => {
    await ada.PUT('/v1/cities/{cityId}/undated-visits', {
      ...city(wuppertal),
      body: { count: 620, beforeRegistration: true },
    });

    const { data } = await ada.GET('/v1/me/export');

    expect(data?.visits).toHaveLength(620);
    expect(new Set(data?.visits.map((visit) => visit.id)).size).toBe(620);
  });

  it('is empty but complete for a new user', async () => {
    const { data } = await ada.GET('/v1/me/export');

    expect(data).toMatchObject({
      visits: [],
      livedCities: [],
      plannedCities: [],
      ratings: [],
      lists: [],
      cities: [],
    });
  });

  it('has only the data of the signed-in user (NFR-SEC-003)', async () => {
    await fillAccount(bob);

    const { data } = await ada.GET('/v1/me/export');

    expect(data?.visits).toEqual([]);
    expect(data?.lists).toEqual([]);
    expect(data?.cities).toEqual([]);
  });

  it('needs a signed-in user', async () => {
    const { response } = await clientFor(null).GET('/v1/me/export');

    expect(response.status).toBe(401);
  });
});
