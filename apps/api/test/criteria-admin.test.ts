import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import {
  createTestApi,
  initialCriteria,
  insertCity,
  registerUser,
  resetCriteria,
  resetData,
} from './api.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);
const wuppertal = 1;

const { clientFor } = createTestApi(sql);
const admin = clientFor('grace-token');
const ada = clientFor('ada-token');

const initialKeys = initialCriteria.map(({ key }) => key);

const add = (body: { key: string; name: string; sortOrder?: number }, client = admin) =>
  client.POST('/v1/admin/criteria', { body });
const change = (
  key: string,
  body: { name?: string; active?: boolean; sortOrder?: number },
  client = admin,
) => client.PATCH('/v1/admin/criteria/{key}', { params: { path: { key } }, body });
const rateableKeys = async () =>
  (await ada.GET('/v1/criteria')).data?.items.map((criterion) => criterion.key);

beforeEach(async () => {
  await resetData(sql);
  await resetCriteria(sql);
  await insertCity(sql, wuppertal, 'Wuppertal');
  await registerUser(sql, 'ada', '2026-03-01T10:00:00Z');
  await registerUser(sql, 'grace', '2026-01-01T10:00:00Z');
  await sql`UPDATE users SET roles = '{user,administrator}' WHERE auth_provider_id = 'clerk_grace'`;
});
afterAll(async () => {
  await resetData(sql);
  await resetCriteria(sql);
  await sql.end();
});

describe('Managing criteria is for administrators only (FR-RATE-006, FR-AUTH-010)', () => {
  it('rejects a registered user without the role', async () => {
    const listed = await ada.GET('/v1/admin/criteria');
    const added = await add({ key: 'nightlife', name: 'Nightlife' }, ada);
    const changed = await change('safety', { active: false }, ada);

    expect(listed.response.status).toBe(403);
    expect(added.response.status).toBe(403);
    expect(changed.response.status).toBe(403);
    expect(await rateableKeys()).toEqual(initialKeys);
  });

  it('rejects a guest', async () => {
    const { response } = await add({ key: 'nightlife', name: 'Nightlife' }, clientFor(null));

    expect(response.status).toBe(401);
  });
});

describe('POST /v1/admin/criteria (FR-RATE-006)', () => {
  it('adds a criterion that users can then rate for any city', async () => {
    const { data, response } = await add({ key: 'nightlife', name: 'Nightlife' });
    await ada.POST('/v1/visits', { body: { cityId: wuppertal, date: '2026-05-10' } });
    const rated = await ada.PUT('/v1/cities/{cityId}/rating', {
      params: { path: { cityId: wuppertal } },
      body: { subjective: 8, criteria: { nightlife: 9 } },
    });

    expect(response.status).toBe(201);
    expect(data).toEqual({ key: 'nightlife', name: 'Nightlife', active: true, sortOrder: 70 });
    expect(await rateableKeys()).toEqual([...initialKeys, 'nightlife']);
    expect(rated.data?.criteria).toEqual({ nightlife: 9 });
  });

  it('puts a criterion where its sort order says', async () => {
    await add({ key: 'nightlife', name: 'Nightlife', sortOrder: 15 });

    expect((await rateableKeys())?.slice(0, 3)).toEqual(['architecture', 'nightlife', 'urbanism']);
  });

  it('rejects a key that is taken', async () => {
    const { response } = await add({ key: 'safety', name: 'Security' });

    expect(response.status).toBe(409);
  });

  it.each(['Nightlife', 'night life', 'n', '1st', 'night__life', '_night'])(
    'rejects the key %j',
    async (key) => {
      const { response } = await add({ key, name: 'Nightlife' });

      expect(response.status).toBe(400);
    },
  );

  it('rejects an empty name', async () => {
    const { response } = await add({ key: 'nightlife', name: '  ' });

    expect(response.status).toBe(400);
  });
});

describe('PATCH /v1/admin/criteria/{key} (FR-RATE-006)', () => {
  it('renames and reorders a criterion and leaves the rest as it is', async () => {
    const { data } = await change('greenery', { name: 'Green spaces', sortOrder: 5 });

    expect(data).toEqual({ key: 'greenery', name: 'Green spaces', active: true, sortOrder: 5 });
    expect((await rateableKeys())?.[0]).toBe('greenery');
  });

  it('removes a criterion by switching it off, without deleting its ratings', async () => {
    await ada.POST('/v1/visits', { body: { cityId: wuppertal, date: '2026-05-10' } });
    await ada.PUT('/v1/cities/{cityId}/rating', {
      params: { path: { cityId: wuppertal } },
      body: { subjective: 8, criteria: { safety: 9 } },
    });

    const { data } = await change('safety', { active: false });

    expect(data?.active).toBe(false);
    expect(await rateableKeys()).not.toContain('safety');
    expect(await sql`SELECT 1 FROM criterion_ratings`).toHaveLength(1);
  });

  it('brings the ratings back when the criterion is switched on again', async () => {
    await ada.POST('/v1/visits', { body: { cityId: wuppertal, date: '2026-05-10' } });
    await ada.PUT('/v1/cities/{cityId}/rating', {
      params: { path: { cityId: wuppertal } },
      body: { subjective: 8, criteria: { safety: 9 } },
    });
    await change('safety', { active: false });

    await change('safety', { active: true });

    const { data } = await ada.GET('/v1/cities/{cityId}/rating', {
      params: { path: { cityId: wuppertal } },
    });
    expect(data?.criteria).toEqual({ safety: 9 });
  });

  it('answers 404 for a criterion that does not exist', async () => {
    const { response } = await change('nightlife', { active: false });

    expect(response.status).toBe(404);
  });
});

describe('GET /v1/admin/criteria (FR-RATE-006)', () => {
  it('lists all criteria, also those that are switched off', async () => {
    await change('safety', { active: false });

    const { data } = await admin.GET('/v1/admin/criteria');

    expect(data?.items.map((criterion) => criterion.key)).toEqual(initialKeys);
    expect(data?.items.find((criterion) => criterion.key === 'safety')?.active).toBe(false);
  });
});
