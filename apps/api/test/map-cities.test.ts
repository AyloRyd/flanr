import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import { syncUserFromClerk } from '../src/users.ts';
import { createTestApi, insertCity, resetData } from './api.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);
const [wuppertal, aachen, bonn, kerpen] = [1, 2, 3, 4];

const { clientFor } = createTestApi(sql);
const ada = clientFor('ada-token');
const bob = clientFor('bob-token');
const guest = clientFor(null);

const ownMap = (client = ada) => client.GET('/v1/map-cities');
const mapOf = (username: string, client = guest) =>
  client.GET('/v1/users/{username}/map-cities', { params: { path: { username } } });

/**
 * Ada has visited Wuppertal twice and rated it 7.5, lives in Bonn and has visited it once,
 * plans Aachen. Bob has visited Kerpen.
 */
beforeEach(async () => {
  await resetData(sql);
  for (const [id, name] of [
    [wuppertal, 'Wuppertal'],
    [aachen, 'Aachen'],
    [bonn, 'Bonn'],
    [kerpen, 'Kerpen'],
  ] as const) {
    await insertCity(sql, id, name);
  }
  await sql`
    UPDATE cities SET centre = ST_SetSRID(ST_MakePoint(7.1500001, 51.2562149), 4326),
      population = 355100, settlement_type = 'city'
    WHERE id = ${wuppertal}`;
  await sql`UPDATE cities SET settlement_type = 'town' WHERE id = ${kerpen}`;
  for (const name of ['ada', 'bob']) {
    await syncUserFromClerk(sql, {
      authProviderId: `clerk_${name}`,
      username: name,
      displayName: name,
      avatarUrl: null,
    });
  }
  for (const date of ['2026-05-10', '2026-06-01']) {
    await ada.POST('/v1/visits', { body: { cityId: wuppertal, date } });
  }
  await ada.PUT('/v1/cities/{cityId}/rating', {
    params: { path: { cityId: wuppertal } },
    body: { subjective: 7.5 },
  });
  await ada.POST('/v1/visits', { body: { cityId: bonn, date: '2026-04-01' } });
  await ada.PUT('/v1/lived-cities/{cityId}', {
    params: { path: { cityId: bonn } },
    body: { isCurrent: true },
  });
  await ada.PUT('/v1/planned-cities/{cityId}', { params: { path: { cityId: aachen } } });
  await bob.POST('/v1/visits', { body: { cityId: kerpen, date: '2026-04-01' } });
});
afterAll(async () => {
  await sql.end();
});

describe('GET /v1/map-cities (FR-MAP-005, FR-MAP-006)', () => {
  it('gives every visited city with its visits, lived-in mark and rating', async () => {
    const { data } = await ownMap();

    expect(data?.visited).toEqual([
      {
        cityId: wuppertal,
        longitude: 7.15,
        latitude: 51.25621,
        settlementType: 'city',
        population: 355100,
        visitCount: 2,
        livedIn: false,
        rating: 7.5,
      },
      {
        cityId: bonn,
        longitude: 7,
        latitude: 51,
        settlementType: 'city',
        population: null,
        visitCount: 1,
        livedIn: true,
        rating: null,
      },
    ]);
  });

  it('gives the planned cities apart from the visited ones', async () => {
    const { data } = await ownMap();

    expect(data?.planned).toEqual([
      {
        cityId: aachen,
        longitude: 7,
        latitude: 51,
        settlementType: 'city',
        population: null,
      },
    ]);
  });

  it('has only the cities of the signed-in user (NFR-SEC-003)', async () => {
    const { data } = await ownMap(bob);

    expect(data).toEqual({ visited: [expect.objectContaining({ cityId: kerpen })], planned: [] });
  });

  it('needs a signed-in user', async () => {
    const { response } = await guest.GET('/v1/map-cities');

    expect(response.status).toBe(401);
  });
});

describe('GET /v1/users/{username}/map-cities (FR-MAP-007)', () => {
  it('shows a guest the same map as the owner sees', async () => {
    const [own, forGuest] = await Promise.all([ownMap(), mapOf('ada')]);

    expect(forGuest.response.status).toBe(200);
    expect(forGuest.data).toEqual(own.data);
  });

  it('does not show which lived-in city is the current one (BR-016, FR-PROF-003)', async () => {
    const { data } = await mapOf('ada');

    expect(JSON.stringify(data)).not.toMatch(/isCurrent|current/i);
  });

  it('is not shown for a private profile, not even to signed-in users (FR-PRIV-001)', async () => {
    await ada.PATCH('/v1/me', { body: { profileVisibility: 'private' } });

    const [forGuest, forBob, own] = await Promise.all([mapOf('ada'), mapOf('ada', bob), ownMap()]);

    expect(forGuest.response.status).toBe(403);
    expect(forBob.response.status).toBe(403);
    expect(own.data?.visited).toHaveLength(2);
  });

  it('answers 404 for an unknown user', async () => {
    const { response } = await mapOf('nobody');

    expect(response.status).toBe(404);
  });
});
