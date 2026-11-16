import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import { createTestApi, insertCity, resetCriteria, resetData } from './api.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);
const [wuppertal, aachen, bonn] = [1, 2, 3];

const { clientFor } = createTestApi(sql);
const ada = clientFor('ada-token');
const bob = clientFor('bob-token');
const guest = clientFor(null);

const ownDataOf = (cityId: number, client = ada) =>
  client.GET('/v1/me/cities/{cityId}', { params: { path: { cityId } } });

beforeEach(async () => {
  await resetData(sql);
  await resetCriteria(sql);
  for (const [id, name] of [
    [wuppertal, 'Wuppertal'],
    [aachen, 'Aachen'],
    [bonn, 'Bonn'],
  ] as const) {
    await insertCity(sql, id, name);
  }
});
afterAll(async () => {
  await sql.end();
});

describe('GET /v1/me/cities/{cityId} (FR-CITY-004)', () => {
  it('shows two visits and the rating 8 of a user', async () => {
    await ada.POST('/v1/visits', { body: { cityId: wuppertal, date: '2026-05-10' } });
    await ada.POST('/v1/visits', { body: { cityId: wuppertal, date: '2026-06' } });
    await ada.PUT('/v1/cities/{cityId}/rating', {
      params: { path: { cityId: wuppertal } },
      body: { subjective: 8 },
    });

    const { data, response } = await ownDataOf(wuppertal);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      cityId: wuppertal,
      visitCount: 2,
      undatedVisitCount: 0,
      lived: null,
      visited: true,
      planned: false,
      rating: { cityId: wuppertal, subjective: 8 },
      lists: [],
    });
  });

  it('counts undated visits among all visits (FR-VIS-005)', async () => {
    await ada.PUT('/v1/cities/{cityId}/undated-visits', {
      params: { path: { cityId: wuppertal } },
      body: { count: 3, beforeRegistration: true },
    });

    expect((await ownDataOf(wuppertal)).data).toMatchObject({
      visitCount: 3,
      undatedVisitCount: 3,
      visited: true,
    });
  });

  it('says that a city is planned, and has nothing else for it', async () => {
    await ada.PUT('/v1/planned-cities/{cityId}', { params: { path: { cityId: aachen } } });

    expect((await ownDataOf(aachen)).data).toEqual({
      cityId: aachen,
      visitCount: 0,
      undatedVisitCount: 0,
      lived: null,
      visited: false,
      planned: true,
      rating: null,
      lists: [],
    });
  });

  it('counts a lived-in city as visited without visits (BR-004, BR-016)', async () => {
    await ada.PUT('/v1/lived-cities/{cityId}', {
      params: { path: { cityId: bonn } },
      body: { isCurrent: true, from: '2020-09' },
    });

    expect((await ownDataOf(bonn)).data).toMatchObject({
      visitCount: 0,
      visited: true,
      lived: { isCurrent: true, from: '2020-09', to: null },
    });
  });

  it('lists the custom lists that contain the city, private ones included', async () => {
    for (const [title, visibility] of [
      ['Trams', 'public'],
      ['Secret', 'private'],
      ['Elsewhere', 'public'],
    ] as const) {
      const { data: list } = await ada.POST('/v1/lists', { body: { title, visibility } });
      if (title === 'Elsewhere') continue;
      await ada.POST('/v1/lists/{listId}/entries', {
        params: { path: { listId: list?.id ?? 0 } },
        body: { cityId: wuppertal },
      });
    }

    const { data } = await ownDataOf(wuppertal);

    expect(data?.lists.map(({ title }) => title)).toEqual(['Secret', 'Trams']);
  });

  it("never shows another user's data (NFR-SEC-003)", async () => {
    await ada.POST('/v1/visits', { body: { cityId: wuppertal, date: '2026-05-10' } });

    expect((await ownDataOf(wuppertal, bob)).data).toMatchObject({
      visitCount: 0,
      visited: false,
    });
  });

  it('needs a signed-in user and an existing city', async () => {
    expect((await ownDataOf(wuppertal, guest)).response.status).toBe(401);
    expect((await ownDataOf(999)).response.status).toBe(404);
  });
});
