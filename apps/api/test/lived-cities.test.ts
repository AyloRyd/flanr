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

const mark = (
  cityId: number,
  body: { isCurrent: boolean; from?: string | null; to?: string | null },
  client = ada,
) => client.PUT('/v1/lived-cities/{cityId}', { params: { path: { cityId } }, body });

const livedCities = async (client = ada) => (await client.GET('/v1/lived-cities')).data?.items;

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

describe('PUT /v1/lived-cities/{cityId} (FR-VIS-010, BR-016)', () => {
  it('marks a city without visits as the current lived-in city', async () => {
    const { data, response } = await mark(wuppertal, { isCurrent: true });

    expect(response.status).toBe(200);
    expect(data).toEqual({ cityId: wuppertal, isCurrent: true, from: null, to: null });
    expect(await livedCities()).toEqual([data]);
  });

  it('turns the previous current city into a past one', async () => {
    await mark(wuppertal, { isCurrent: true });

    await mark(aachen, { isCurrent: true });

    expect(await livedCities()).toEqual([
      { cityId: wuppertal, isCurrent: false, from: null, to: null },
      { cityId: aachen, isCurrent: true, from: null, to: null },
    ]);
  });

  it('allows any number of past cities', async () => {
    await mark(wuppertal, { isCurrent: false });
    await mark(aachen, { isCurrent: false });

    expect((await livedCities())?.map((city) => city.isCurrent)).toEqual([false, false]);
  });

  it('changes the mark of a city that is already lived-in', async () => {
    await mark(wuppertal, { isCurrent: true });

    await mark(wuppertal, { isCurrent: false, from: '2019-09', to: '2024' });

    expect(await livedCities()).toEqual([
      { cityId: wuppertal, isCurrent: false, from: '2019-09', to: '2024' },
    ]);
  });

  it('saves a period with the precision of visit dates (OI-019)', async () => {
    const { data } = await mark(wuppertal, { isCurrent: true, from: '2024-10-01' });

    expect(data).toMatchObject({ from: '2024-10-01', to: null });
  });

  it.each([
    ['a start in the future', { isCurrent: false, from: '2027' }, 'from'],
    ['an end in the future', { isCurrent: false, to: '2026-12' }, 'to'],
    ['an end before the start', { isCurrent: false, from: '2023', to: '2019' }, 'to'],
    ['an end for the current city', { isCurrent: true, to: '2025' }, 'to'],
  ])('rejects %s', async (_case, body, path) => {
    const { error, response } = await mark(wuppertal, body);

    expect(response.status).toBe(400);
    expect(error?.errors?.[0]?.path).toBe(path);
    expect(await livedCities()).toEqual([]);
  });

  it('keeps the current city of another user (NFR-SEC-003)', async () => {
    await mark(wuppertal, { isCurrent: true });

    await mark(aachen, { isCurrent: true }, bob);

    expect(await livedCities()).toEqual([
      { cityId: wuppertal, isCurrent: true, from: null, to: null },
    ]);
  });

  it('answers 404 for a city that does not exist', async () => {
    const { response } = await mark(999, { isCurrent: true });

    expect(response.status).toBe(404);
  });

  it('needs a signed-in user (NFR-SEC-003)', async () => {
    const { response } = await mark(wuppertal, { isCurrent: true }, clientFor(null));

    expect(response.status).toBe(401);
  });

  it('still lets the user log a dated visit to the city', async () => {
    await mark(wuppertal, { isCurrent: true });

    const { response } = await ada.POST('/v1/visits', {
      body: { cityId: wuppertal, date: '2026-05-10' },
    });

    expect(response.status).toBe(201);
  });
});

describe('DELETE /v1/lived-cities/{cityId} (FR-VIS-010)', () => {
  const unmark = (cityId: number, client = ada) =>
    client.DELETE('/v1/lived-cities/{cityId}', { params: { path: { cityId } } });

  it('removes the mark', async () => {
    await mark(wuppertal, { isCurrent: true });

    const { response } = await unmark(wuppertal);

    expect(response.status).toBe(204);
    expect(await livedCities()).toEqual([]);
  });

  it('answers 404 for a city the user has not marked, and keeps the mark of another user', async () => {
    await mark(wuppertal, { isCurrent: true });

    const { response } = await unmark(wuppertal, bob);

    expect(response.status).toBe(404);
    expect(await livedCities()).toHaveLength(1);
  });
});

describe('GET /v1/lived-cities', () => {
  it('is paginated (SRS 6.2)', async () => {
    await mark(wuppertal, { isCurrent: false });
    await mark(aachen, { isCurrent: true });

    const first = await ada.GET('/v1/lived-cities', { params: { query: { limit: 1 } } });
    const cursor = first.data?.nextCursor ?? undefined;
    const second = await ada.GET('/v1/lived-cities', { params: { query: { limit: 1, cursor } } });

    expect(first.data?.items.map((city) => city.cityId)).toEqual([wuppertal]);
    expect(second.data?.items.map((city) => city.cityId)).toEqual([aachen]);
    expect(second.data?.nextCursor).toBeNull();
  });
});

describe('Account deletion', () => {
  it('removes the lived-in cities with the user (FR-AUTH-009)', async () => {
    await mark(wuppertal, { isCurrent: true });

    await sql`DELETE FROM users WHERE auth_provider_id = 'clerk_ada'`;

    expect(await sql`SELECT 1 FROM lived_cities`).toHaveLength(0);
  });
});
