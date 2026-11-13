import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import { createTestApi, insertCity, registerUser, resetData } from './api.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);
const wuppertal = 1;
const aachen = 2;

const { clientFor } = createTestApi(sql);
const ada = clientFor('ada-token');
const bob = clientFor('bob-token');

const plan = (cityId: number, client = ada) =>
  client.PUT('/v1/planned-cities/{cityId}', { params: { path: { cityId } } });
const unplan = (cityId: number, client = ada) =>
  client.DELETE('/v1/planned-cities/{cityId}', { params: { path: { cityId } } });
const logVisit = (cityId: number, client = ada) =>
  client.POST('/v1/visits', { body: { cityId, date: '2026-05-10' } });
async function deleteOnlyVisit(cityId: number) {
  const { data: visit } = await logVisit(cityId);
  if (!visit) throw new Error('Visit was not created');
  await ada.DELETE('/v1/visits/{visitId}', { params: { path: { visitId: visit.id } } });
}
const markLived = (cityId: number) =>
  ada.PUT('/v1/lived-cities/{cityId}', {
    params: { path: { cityId } },
    body: { isCurrent: true },
  });

const plannedIds = async (client = ada) =>
  (await client.GET('/v1/planned-cities')).data?.items.map((city) => city.cityId);
const visited = async (client = ada) => (await client.GET('/v1/visited-cities')).data?.items;

beforeEach(async () => {
  await resetData(sql);
  await insertCity(sql, wuppertal, 'Wuppertal');
  await insertCity(sql, aachen, 'Aachen');
  await registerUser(sql, 'ada', '2026-03-01T10:00:00Z');
  await registerUser(sql, 'bob', '2026-01-01T10:00:00Z');
});
afterAll(async () => {
  await sql.end();
});

describe('Default lists (FR-LIST-001)', () => {
  it('are both empty for a new user', async () => {
    expect(await visited()).toEqual([]);
    expect(await plannedIds()).toEqual([]);
  });

  it('need a signed-in user (NFR-SEC-003)', async () => {
    const guest = clientFor(null);

    expect((await guest.GET('/v1/visited-cities')).response.status).toBe(401);
    expect((await guest.GET('/v1/planned-cities')).response.status).toBe(401);
    expect((await plan(wuppertal, guest)).response.status).toBe(401);
    expect((await unplan(wuppertal, guest)).response.status).toBe(401);
  });
});

describe('GET /v1/visited-cities (FR-LIST-001, BR-004)', () => {
  it('has a city from its first visit on, with the number of visits', async () => {
    await logVisit(wuppertal);
    await logVisit(wuppertal);

    expect(await visited()).toEqual([{ cityId: wuppertal, visitCount: 2, livedIn: false }]);
  });

  it('counts undated visits', async () => {
    await ada.PUT('/v1/cities/{cityId}/undated-visits', {
      params: { path: { cityId: aachen } },
      body: { count: 3, beforeRegistration: true },
    });

    expect(await visited()).toEqual([{ cityId: aachen, visitCount: 3, livedIn: false }]);
  });

  it('has a lived-in city without visits (BR-016, FR-VIS-010)', async () => {
    await markLived(wuppertal);

    expect(await visited()).toEqual([{ cityId: wuppertal, visitCount: 0, livedIn: true }]);
  });

  it('lists a lived-in city with visits once', async () => {
    await markLived(wuppertal);
    await logVisit(wuppertal);

    expect(await visited()).toEqual([{ cityId: wuppertal, visitCount: 1, livedIn: true }]);
  });

  it('loses a city when its only visit is deleted (FR-VIS-006)', async () => {
    await deleteOnlyVisit(wuppertal);

    expect(await visited()).toEqual([]);
  });

  it('shows only the cities of the signed-in user (NFR-SEC-003)', async () => {
    await logVisit(wuppertal, bob);

    expect(await visited()).toEqual([]);
  });

  it('is paginated (SRS 6.2)', async () => {
    await logVisit(wuppertal);
    await markLived(aachen);

    const first = await ada.GET('/v1/visited-cities', { params: { query: { limit: 1 } } });
    const cursor = first.data?.nextCursor ?? undefined;
    const second = await ada.GET('/v1/visited-cities', { params: { query: { limit: 1, cursor } } });

    expect(first.data?.items.map((city) => city.cityId)).toEqual([wuppertal]);
    expect(second.data?.items.map((city) => city.cityId)).toEqual([aachen]);
    expect(second.data?.nextCursor).toBeNull();
  });
});

describe('PUT /v1/planned-cities/{cityId} (FR-LIST-002)', () => {
  it('adds a city the user has not visited', async () => {
    const { data, response } = await plan(wuppertal);

    expect(response.status).toBe(200);
    expect(data).toEqual({ cityId: wuppertal, addedAt: expect.any(String) });
    expect(await plannedIds()).toEqual([wuppertal]);
  });

  it('keeps a planned city as it is when it is planned again', async () => {
    const first = await plan(wuppertal);

    const second = await plan(wuppertal);

    expect(second.response.status).toBe(200);
    expect(second.data).toEqual(first.data);
    expect(await plannedIds()).toEqual([wuppertal]);
  });

  it('rejects a city the user has visited (BR-004)', async () => {
    await logVisit(wuppertal);

    const { error, response } = await plan(wuppertal);

    expect(response.status).toBe(409);
    expect(error).toMatchObject({ status: 409, title: 'City already visited' });
    expect(await plannedIds()).toEqual([]);
  });

  it('rejects a lived-in city without visits (BR-004, BR-016)', async () => {
    await markLived(wuppertal);

    const { response } = await plan(wuppertal);

    expect(response.status).toBe(409);
  });

  it('allows a city that only another user has visited (NFR-SEC-003)', async () => {
    await logVisit(wuppertal, bob);

    const { response } = await plan(wuppertal);

    expect(response.status).toBe(200);
  });

  it('allows a city again after its only visit is deleted', async () => {
    await deleteOnlyVisit(wuppertal);

    const { response } = await plan(wuppertal);

    expect(response.status).toBe(200);
  });

  it('answers 404 for a city that does not exist', async () => {
    const { response } = await plan(999);

    expect(response.status).toBe(404);
  });
});

describe('Becoming visited removes a city from the Planned list (BR-004, FR-LIST-002)', () => {
  beforeEach(async () => {
    await plan(wuppertal);
    await plan(aachen);
  });

  it('when the user logs a visit', async () => {
    await logVisit(wuppertal);

    expect(await plannedIds()).toEqual([aachen]);
    expect((await visited())?.map((city) => city.cityId)).toEqual([wuppertal]);
  });

  it('when the user sets the number of undated visits', async () => {
    await ada.PUT('/v1/cities/{cityId}/undated-visits', {
      params: { path: { cityId: wuppertal } },
      body: { count: 2, beforeRegistration: true },
    });

    expect(await plannedIds()).toEqual([aachen]);
  });

  it('but not when the number of undated visits stays zero', async () => {
    await ada.PUT('/v1/cities/{cityId}/undated-visits', {
      params: { path: { cityId: wuppertal } },
      body: { count: 0, beforeRegistration: true },
    });

    expect(await plannedIds()).toEqual([wuppertal, aachen]);
  });

  it('when the user marks it as a lived-in city', async () => {
    await markLived(wuppertal);

    expect(await plannedIds()).toEqual([aachen]);
  });

  it('only for the user who visited it (NFR-SEC-003)', async () => {
    await logVisit(wuppertal, bob);

    expect(await plannedIds()).toEqual([wuppertal, aachen]);
  });

  it('never leaves a city in both lists when a visit and a plan are saved together', async () => {
    await unplan(wuppertal);

    await Promise.all([logVisit(wuppertal), plan(wuppertal)]);

    expect(await plannedIds()).toEqual([aachen]);
    expect((await visited())?.map((city) => city.cityId)).toEqual([wuppertal]);
  });
});

describe('DELETE /v1/planned-cities/{cityId} (FR-LIST-002)', () => {
  it('removes the city from the list', async () => {
    await plan(wuppertal);

    const { response } = await unplan(wuppertal);

    expect(response.status).toBe(204);
    expect(await plannedIds()).toEqual([]);
  });

  it('answers 404 for a city that is not planned, and keeps the list of another user', async () => {
    await plan(wuppertal);

    const { response } = await unplan(wuppertal, bob);

    expect(response.status).toBe(404);
    expect(await plannedIds()).toEqual([wuppertal]);
  });
});

describe('GET /v1/planned-cities', () => {
  it('is paginated (SRS 6.2)', async () => {
    await plan(wuppertal);
    await plan(aachen);

    const first = await ada.GET('/v1/planned-cities', { params: { query: { limit: 1 } } });
    const cursor = first.data?.nextCursor ?? undefined;
    const second = await ada.GET('/v1/planned-cities', { params: { query: { limit: 1, cursor } } });

    expect(first.data?.items.map((city) => city.cityId)).toEqual([wuppertal]);
    expect(second.data?.items.map((city) => city.cityId)).toEqual([aachen]);
    expect(second.data?.nextCursor).toBeNull();
  });

  it('rejects a cursor it did not return', async () => {
    const { response } = await ada.GET('/v1/planned-cities', {
      params: { query: { cursor: 'x' } },
    });

    expect(response.status).toBe(400);
  });
});

describe('Account deletion', () => {
  it('removes the Planned list with the user (FR-AUTH-009)', async () => {
    await plan(wuppertal);

    await sql`DELETE FROM users WHERE auth_provider_id = 'clerk_ada'`;

    expect(await sql`SELECT 1 FROM planned_cities`).toHaveLength(0);
  });
});
