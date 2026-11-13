import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import { createTestApi, insertCity, registerUser, resetData } from './api.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);
const cologne = 1;
const bonn = 2;

// Ada registered on 2026-03-01; the tests run on 2026-11-12.
const { clientFor } = createTestApi(sql);
const ada = clientFor('ada-token');
const bob = clientFor('bob-token');

async function logVisit(date: string | null, cityId = cologne, beforeRegistration = date === null) {
  const { data } = await ada.POST('/v1/visits', { body: { cityId, date, beforeRegistration } });
  if (!data) throw new Error('Visit was not created');
  return data;
}

beforeEach(async () => {
  await resetData(sql);
  await insertCity(sql, cologne, 'Köln');
  await insertCity(sql, bonn, 'Bonn');
  await registerUser(sql, 'ada', '2026-03-01T10:00:00Z');
  await registerUser(sql, 'bob', '2026-01-01T10:00:00Z');
});
afterAll(async () => {
  await sql.end();
});

describe('POST /v1/visits', () => {
  it('saves a dated visit and counts it for the city (FR-VIS-001)', async () => {
    const { data, response } = await ada.POST('/v1/visits', {
      body: { cityId: cologne, date: '2026-05-10' },
    });

    expect(response.status).toBe(201);
    expect(data).toMatchObject({
      cityId: cologne,
      date: '2026-05-10',
      datePrecision: 'day',
      beforeRegistration: false,
    });
    const { data: page } = await ada.GET('/v1/visits', { params: { query: { cityId: cologne } } });
    expect(page?.items).toHaveLength(1);
  });

  it('saves a month and a year with that precision (FR-VIS-002)', async () => {
    expect(await logVisit('2026-05')).toMatchObject({ date: '2026-05', datePrecision: 'month' });
    expect(await logVisit('2019')).toMatchObject({
      date: '2019',
      datePrecision: 'year',
      beforeRegistration: true,
    });
  });

  it('rejects a date in the future (BR-003, FR-VIS-002)', async () => {
    const { error, response } = await ada.POST('/v1/visits', {
      body: { cityId: cologne, date: '2026-11-14' },
    });

    expect(response.status).toBe(400);
    expect(error?.errors).toEqual([{ path: 'date', message: 'A visit cannot be in the future.' }]);
  });

  it('rejects something that is not a date', async () => {
    const { response } = await ada.POST('/v1/visits', {
      body: { cityId: cologne, date: '2026-02-30' },
    });

    expect(response.status).toBe(400);
  });

  it('saves an undated visit that is confirmed to be from before the registration (BR-002, FR-VIS-003)', async () => {
    const { data, response } = await ada.POST('/v1/visits', {
      body: { cityId: cologne, date: null, beforeRegistration: true },
    });

    expect(response.status).toBe(201);
    expect(data).toMatchObject({ date: null, datePrecision: 'none', beforeRegistration: true });
  });

  it('asks for a date when an undated visit is not confirmed (BR-002, FR-VIS-003)', async () => {
    const { error, response } = await ada.POST('/v1/visits', {
      body: { cityId: cologne, date: null },
    });

    expect(response.status).toBe(400);
    expect(error?.errors?.[0]?.path).toBe('date');
    expect(await sql`SELECT 1 FROM visits`).toHaveLength(0);
  });

  it('answers 404 for a city that does not exist', async () => {
    const { response } = await ada.POST('/v1/visits', { body: { cityId: 999, date: '2026-05' } });

    expect(response.status).toBe(404);
  });

  it('needs a signed-in user (NFR-SEC-003)', async () => {
    const { response } = await clientFor(null).POST('/v1/visits', {
      body: { cityId: cologne, date: '2026-05' },
    });

    expect(response.status).toBe(401);
  });
});

describe('GET /v1/visits', () => {
  it('returns only the visits of the signed-in user (NFR-SEC-003)', async () => {
    await logVisit('2026-05');
    await bob.POST('/v1/visits', { body: { cityId: cologne, date: '2026-06' } });

    const { data } = await ada.GET('/v1/visits');

    expect(data?.items.map((visit) => visit.date)).toEqual(['2026-05']);
  });

  it('filters by city', async () => {
    await logVisit('2026-05', cologne);
    await logVisit('2026-06', bonn);

    const { data } = await ada.GET('/v1/visits', { params: { query: { cityId: bonn } } });

    expect(data?.items.map((visit) => visit.cityId)).toEqual([bonn]);
  });

  it('is paginated, newest first (SRS 6.2)', async () => {
    for (const date of ['2026-04', '2026-05', '2026-06']) await logVisit(date);

    const first = await ada.GET('/v1/visits', { params: { query: { limit: 2 } } });
    const cursor = first.data?.nextCursor ?? undefined;
    const second = await ada.GET('/v1/visits', { params: { query: { limit: 2, cursor } } });

    expect(first.data?.items.map((visit) => visit.date)).toEqual(['2026-06', '2026-05']);
    expect(cursor).toBeDefined();
    expect(second.data?.items.map((visit) => visit.date)).toEqual(['2026-04']);
    expect(second.data?.nextCursor).toBeNull();
  });
});

describe('PATCH /v1/visits/{visitId} (FR-VIS-006)', () => {
  it('saves a new date', async () => {
    const visit = await logVisit('2026-05-10');

    const { data } = await ada.PATCH('/v1/visits/{visitId}', {
      params: { path: { visitId: visit.id } },
      body: { date: '2026-04' },
    });

    expect(data).toMatchObject({ id: visit.id, date: '2026-04', datePrecision: 'month' });
  });

  it('rejects a date in the future (BR-003)', async () => {
    const visit = await logVisit('2026-05-10');

    const { response } = await ada.PATCH('/v1/visits/{visitId}', {
      params: { path: { visitId: visit.id } },
      body: { date: '2027' },
    });

    expect(response.status).toBe(400);
  });

  it('does not let a visit from after the registration lose its date (BR-002, FR-VIS-004)', async () => {
    const visit = await logVisit('2026-05-10');

    const { response } = await ada.PATCH('/v1/visits/{visitId}', {
      params: { path: { visitId: visit.id } },
      body: { date: null, beforeRegistration: true },
    });

    expect(response.status).toBe(400);
    const { data } = await ada.GET('/v1/visits');
    expect(data?.items[0]?.date).toBe('2026-05-10');
  });

  it('lets a visit from before the registration lose its date (BR-002)', async () => {
    const visit = await logVisit('2025-08');

    const { data } = await ada.PATCH('/v1/visits/{visitId}', {
      params: { path: { visitId: visit.id } },
      body: { date: null, beforeRegistration: true },
    });

    expect(data).toMatchObject({ date: null, datePrecision: 'none', beforeRegistration: true });
  });

  it("answers 404 for another user's visit and leaves it unchanged (NFR-SEC-003)", async () => {
    const visit = await logVisit('2026-05-10');

    const { response } = await bob.PATCH('/v1/visits/{visitId}', {
      params: { path: { visitId: visit.id } },
      body: { date: '2026-04' },
    });

    expect(response.status).toBe(404);
    const { data } = await ada.GET('/v1/visits');
    expect(data?.items[0]?.date).toBe('2026-05-10');
  });
});

describe('DELETE /v1/visits/{visitId} (FR-VIS-006)', () => {
  it('deletes the visit, so the city has no visits left', async () => {
    const visit = await logVisit('2026-05-10');

    const { response } = await ada.DELETE('/v1/visits/{visitId}', {
      params: { path: { visitId: visit.id } },
    });

    expect(response.status).toBe(204);
    const { data } = await ada.GET('/v1/visits', { params: { query: { cityId: cologne } } });
    expect(data?.items).toEqual([]);
  });

  it("answers 404 for another user's visit and keeps it (NFR-SEC-003)", async () => {
    const visit = await logVisit('2026-05-10');

    const { response } = await bob.DELETE('/v1/visits/{visitId}', {
      params: { path: { visitId: visit.id } },
    });

    expect(response.status).toBe(404);
    expect(await sql`SELECT 1 FROM visits`).toHaveLength(1);
  });
});

describe('PUT /v1/cities/{cityId}/undated-visits (FR-VIS-005)', () => {
  const setCount = (count: number, beforeRegistration = true, client = ada) =>
    client.PUT('/v1/cities/{cityId}/undated-visits', {
      params: { path: { cityId: cologne } },
      body: { count, beforeRegistration },
    });
  const undatedCount = async (client = ada) =>
    (
      await client.GET('/v1/cities/{cityId}/undated-visits', {
        params: { path: { cityId: cologne } },
      })
    ).data?.count;

  it('adds undated visits up to the number', async () => {
    await setCount(5);

    await setCount(6);

    expect(await undatedCount()).toBe(6);
  });

  it('removes undated visits down to the number and keeps dated visits', async () => {
    await setCount(5);
    await logVisit('2026-05-10');

    await setCount(4);

    expect(await undatedCount()).toBe(4);
    const { data } = await ada.GET('/v1/visits', { params: { query: { limit: 100 } } });
    expect(data?.items.filter((visit) => visit.date !== null)).toHaveLength(1);
  });

  it('needs the confirmation to add visits, but not to remove them (BR-002, FR-VIS-003)', async () => {
    const added = await setCount(2, false);
    expect(added.response.status).toBe(400);
    expect(await undatedCount()).toBe(0);

    await setCount(3);
    const removed = await setCount(1, false);
    expect(removed.response.status).toBe(200);
    expect(await undatedCount()).toBe(1);
  });

  it("does not touch another user's visits (NFR-SEC-003)", async () => {
    await setCount(3);

    await setCount(0, true, bob);

    expect(await undatedCount()).toBe(3);
    expect(await undatedCount(bob)).toBe(0);
  });

  it('answers 404 for a city that does not exist', async () => {
    const { response } = await ada.PUT('/v1/cities/{cityId}/undated-visits', {
      params: { path: { cityId: 999 } },
      body: { count: 1, beforeRegistration: true },
    });

    expect(response.status).toBe(404);
  });
});

describe('Account deletion', () => {
  it('removes the visits with the user (FR-AUTH-009)', async () => {
    await logVisit('2026-05-10');

    await sql`DELETE FROM users WHERE auth_provider_id = 'clerk_ada'`;

    expect(await sql`SELECT 1 FROM visits`).toHaveLength(0);
  });
});
