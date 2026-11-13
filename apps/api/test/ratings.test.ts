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
const aachen = 2;

const { clientFor } = createTestApi(sql);
const ada = clientFor('ada-token');
const bob = clientFor('bob-token');

const path = (cityId: number) => ({ params: { path: { cityId } } });

const rate = (
  cityId: number,
  body: { subjective: number; criteria?: Record<string, number> },
  client = ada,
) => client.PUT('/v1/cities/{cityId}/rating', { ...path(cityId), body });
const ratingOf = async (cityId: number, client = ada) =>
  (await client.GET('/v1/cities/{cityId}/rating', path(cityId))).data;

async function logVisit(cityId: number, client = ada) {
  const { data } = await client.POST('/v1/visits', { body: { cityId, date: '2026-05-10' } });
  if (!data) throw new Error('Visit was not created');
  return data;
}
const deleteVisit = (visitId: number, confirmRatingDeletion?: 'true') =>
  ada.DELETE('/v1/visits/{visitId}', {
    params: { path: { visitId }, query: { confirmRatingDeletion } },
  });
const setUndated = (cityId: number, count: number, confirmRatingDeletion?: boolean) =>
  ada.PUT('/v1/cities/{cityId}/undated-visits', {
    ...path(cityId),
    body: { count, beforeRegistration: true, confirmRatingDeletion },
  });
const markLived = (cityId: number) =>
  ada.PUT('/v1/lived-cities/{cityId}', { ...path(cityId), body: { isCurrent: true } });
const unmarkLived = (cityId: number, confirmRatingDeletion?: 'true') =>
  ada.DELETE('/v1/lived-cities/{cityId}', {
    params: { path: { cityId }, query: { confirmRatingDeletion } },
  });

beforeEach(async () => {
  await resetData(sql);
  await resetCriteria(sql);
  await insertCity(sql, wuppertal, 'Wuppertal');
  await insertCity(sql, aachen, 'Aachen');
  await registerUser(sql, 'ada', '2026-03-01T10:00:00Z');
  await registerUser(sql, 'bob', '2026-01-01T10:00:00Z');
});
afterAll(async () => {
  await resetData(sql);
  await resetCriteria(sql);
  await sql.end();
});

describe('GET /v1/criteria (FR-RATE-002)', () => {
  it('lists the initial criteria in order, also for guests', async () => {
    const { data } = await clientFor(null).GET('/v1/criteria');

    expect(data?.items).toEqual(initialCriteria);
  });

  it('leaves out a criterion that is switched off (FR-RATE-006)', async () => {
    await sql`UPDATE criteria SET active = false WHERE key = 'safety'`;

    const { data } = await ada.GET('/v1/criteria');

    expect(data?.items.map((criterion) => criterion.key)).not.toContain('safety');
  });
});

describe('PUT /v1/cities/{cityId}/rating', () => {
  it('saves a rating of 7.5 for a visited city (FR-RATE-001)', async () => {
    await logVisit(wuppertal);

    const { data, response } = await rate(wuppertal, { subjective: 7.5 });

    expect(response.status).toBe(200);
    expect(data).toEqual({
      cityId: wuppertal,
      subjective: 7.5,
      criteria: {},
      criteriaAverage: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(await ratingOf(wuppertal)).toEqual(data);
  });

  it('rejects a city the user has not visited (BR-005)', async () => {
    await logVisit(wuppertal, bob);

    const { error, response } = await rate(wuppertal, { subjective: 7 });

    expect(response.status).toBe(409);
    expect(error).toMatchObject({ status: 409, title: 'City not visited' });
    expect(await ratingOf(wuppertal)).toBeUndefined();
  });

  it('accepts a lived-in city without visits (BR-005, FR-VIS-010)', async () => {
    await markLived(wuppertal);

    const { response } = await rate(wuppertal, { subjective: 9 });

    expect(response.status).toBe(200);
  });

  it.each([7.3, 0.5, 10.5])('rejects a rating of %s (BR-006)', async (subjective) => {
    await logVisit(wuppertal);

    const { response } = await rate(wuppertal, { subjective });

    expect(response.status).toBe(400);
    expect(await ratingOf(wuppertal)).toBeUndefined();
  });

  it('needs the subjective rating, criteria alone are not a rating (BR-006)', async () => {
    await logVisit(wuppertal);

    const { response } = await ada.PUT('/v1/cities/{cityId}/rating', {
      ...path(wuppertal),
      body: { criteria: { safety: 8 } } as never,
    });

    expect(response.status).toBe(400);
  });

  it('saves only the criteria the user rated (FR-RATE-002)', async () => {
    await logVisit(wuppertal);

    const { data } = await rate(wuppertal, {
      subjective: 8,
      criteria: { architecture: 7, safety: 8.5 },
    });

    expect(data?.criteria).toEqual({ architecture: 7, safety: 8.5 });
    expect(await sql`SELECT 1 FROM criterion_ratings`).toHaveLength(2);
  });

  it('returns the criteria average, not rounded (BR-007)', async () => {
    await logVisit(wuppertal);

    const { data } = await rate(wuppertal, {
      subjective: 9.5,
      criteria: { architecture: 7, safety: 7.5 },
    });

    expect(data?.criteriaAverage).toBe(7.25);
    // FR-RATE-003: the suggestion can be changed; the user's own value is what is saved.
    expect(data?.subjective).toBe(9.5);
  });

  it('rejects a criterion rating off the scale (BR-006)', async () => {
    await logVisit(wuppertal);

    const { response } = await rate(wuppertal, { subjective: 8, criteria: { safety: 7.3 } });

    expect(response.status).toBe(400);
  });

  it('rejects a criterion that does not exist and saves nothing', async () => {
    await logVisit(wuppertal);

    const { error, response } = await rate(wuppertal, { subjective: 8, criteria: { food: 9 } });

    expect(response.status).toBe(400);
    expect(error?.errors).toEqual([{ path: 'criteria.food', message: 'Not a criterion' }]);
    expect(await ratingOf(wuppertal)).toBeUndefined();
  });

  it('replaces the rating as a whole when it is changed (BR-008, FR-RATE-004)', async () => {
    await logVisit(wuppertal);
    await rate(wuppertal, { subjective: 7, criteria: { architecture: 7, safety: 8 } });

    const { data } = await rate(wuppertal, { subjective: 8, criteria: { greenery: 6 } });

    expect(data).toMatchObject({ subjective: 8, criteria: { greenery: 6 } });
    expect(await sql`SELECT 1 FROM city_ratings`).toHaveLength(1);
    expect(await sql`SELECT 1 FROM criterion_ratings`).toHaveLength(1);
  });

  it('keeps the rating of another user for the same city (BR-008, NFR-SEC-003)', async () => {
    await logVisit(wuppertal);
    await logVisit(wuppertal, bob);
    await rate(wuppertal, { subjective: 7 });

    await rate(wuppertal, { subjective: 3 }, bob);

    expect((await ratingOf(wuppertal))?.subjective).toBe(7);
    expect((await ratingOf(wuppertal, bob))?.subjective).toBe(3);
  });

  it('lets users rate a criterion that was added later (FR-RATE-006)', async () => {
    await sql`INSERT INTO criteria (key, name, sort_order) VALUES ('nightlife', 'Nightlife', 70)`;
    await logVisit(wuppertal);

    const { data } = await rate(wuppertal, { subjective: 8, criteria: { nightlife: 9 } });

    expect(data?.criteria).toEqual({ nightlife: 9 });
  });

  it('keeps the ratings of a criterion that is switched off, outside the rating (FR-RATE-006)', async () => {
    await logVisit(wuppertal);
    await rate(wuppertal, { subjective: 8, criteria: { architecture: 6, safety: 9 } });
    await sql`UPDATE criteria SET active = false WHERE key = 'safety'`;

    const rejected = await rate(wuppertal, { subjective: 8, criteria: { safety: 9 } });
    const { data } = await rate(wuppertal, { subjective: 8, criteria: { architecture: 7 } });

    expect(rejected.response.status).toBe(400);
    expect(data).toMatchObject({ criteria: { architecture: 7 }, criteriaAverage: 7 });
    expect(await sql`SELECT 1 FROM criterion_ratings`).toHaveLength(2);
  });

  it('answers 404 for a city that does not exist', async () => {
    const { response } = await rate(999, { subjective: 7 });

    expect(response.status).toBe(404);
  });

  it('needs a signed-in user (NFR-SEC-003)', async () => {
    const { response } = await rate(wuppertal, { subjective: 7 }, clientFor(null));

    expect(response.status).toBe(401);
  });
});

describe('DELETE /v1/cities/{cityId}/rating (FR-RATE-004)', () => {
  const unrate = (cityId: number, client = ada) =>
    client.DELETE('/v1/cities/{cityId}/rating', path(cityId));

  it('deletes the rating with its criteria ratings and keeps the visit', async () => {
    await logVisit(wuppertal);
    await rate(wuppertal, { subjective: 7, criteria: { safety: 8 } });

    const { response } = await unrate(wuppertal);

    expect(response.status).toBe(204);
    expect(await ratingOf(wuppertal)).toBeUndefined();
    expect(await sql`SELECT 1 FROM criterion_ratings`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM visits`).toHaveLength(1);
  });

  it('answers 404 without a rating, and keeps the rating of another user', async () => {
    await logVisit(wuppertal);
    await rate(wuppertal, { subjective: 7 });

    const { response } = await unrate(wuppertal, bob);

    expect(response.status).toBe(404);
    expect(await ratingOf(wuppertal)).toBeDefined();
  });
});

describe('GET /v1/ratings', () => {
  it('lists only the ratings of the signed-in user, paginated (SRS 6.2)', async () => {
    await logVisit(wuppertal);
    await logVisit(aachen);
    await logVisit(aachen, bob);
    await rate(wuppertal, { subjective: 7 });
    await rate(aachen, { subjective: 8 });
    await rate(aachen, { subjective: 2 }, bob);

    const first = await ada.GET('/v1/ratings', { params: { query: { limit: 1 } } });
    const cursor = first.data?.nextCursor ?? undefined;
    const second = await ada.GET('/v1/ratings', { params: { query: { limit: 1, cursor } } });

    expect(first.data?.items.map((rating) => rating.subjective)).toEqual([7]);
    expect(second.data?.items.map((rating) => rating.subjective)).toEqual([8]);
    expect(second.data?.nextCursor).toBeNull();
  });
});

describe('A rating does not outlive the last visit (BR-005, FR-VIS-006)', () => {
  it('asks for a confirmation before the only visit to a rated city is deleted', async () => {
    const visit = await logVisit(wuppertal);
    await rate(wuppertal, { subjective: 7 });

    const { error, response } = await deleteVisit(visit.id);

    expect(response.status).toBe(409);
    expect(error).toMatchObject({ status: 409, title: 'Rating would be deleted' });
    expect(await sql`SELECT 1 FROM visits`).toHaveLength(1);
    expect(await ratingOf(wuppertal)).toBeDefined();
  });

  it('deletes the rating with the only visit once the user has confirmed', async () => {
    const visit = await logVisit(wuppertal);
    await rate(wuppertal, { subjective: 7, criteria: { safety: 8 } });

    const { response } = await deleteVisit(visit.id, 'true');

    expect(response.status).toBe(204);
    expect(await ratingOf(wuppertal)).toBeUndefined();
    expect(await sql`SELECT 1 FROM criterion_ratings`).toHaveLength(0);
  });

  it('needs no confirmation while another visit remains', async () => {
    const visit = await logVisit(wuppertal);
    await logVisit(wuppertal);
    await rate(wuppertal, { subjective: 7 });

    const { response } = await deleteVisit(visit.id);

    expect(response.status).toBe(204);
    expect(await ratingOf(wuppertal)).toBeDefined();
  });

  it('needs no confirmation for a lived-in city', async () => {
    const visit = await logVisit(wuppertal);
    await markLived(wuppertal);
    await rate(wuppertal, { subjective: 7 });

    const { response } = await deleteVisit(visit.id);

    expect(response.status).toBe(204);
    expect(await ratingOf(wuppertal)).toBeDefined();
  });

  it('needs no confirmation for a city without a rating', async () => {
    const visit = await logVisit(wuppertal);

    const { response } = await deleteVisit(visit.id);

    expect(response.status).toBe(204);
  });

  it('keeps the rating of another city', async () => {
    const visit = await logVisit(wuppertal);
    await logVisit(aachen);
    await rate(aachen, { subjective: 8 });

    await deleteVisit(visit.id, 'true');

    expect(await ratingOf(aachen)).toBeDefined();
  });

  it('asks for a confirmation before the undated visits are set to zero', async () => {
    await setUndated(wuppertal, 2);
    await rate(wuppertal, { subjective: 7 });

    const fewer = await setUndated(wuppertal, 1);
    const none = await setUndated(wuppertal, 0);

    expect(fewer.response.status).toBe(200);
    expect(none.response.status).toBe(409);
    expect(await sql`SELECT 1 FROM visits`).toHaveLength(1);
    expect(await ratingOf(wuppertal)).toBeDefined();
  });

  it('deletes the rating with the last undated visits once the user has confirmed', async () => {
    await setUndated(wuppertal, 2);
    await rate(wuppertal, { subjective: 7 });

    const { response } = await setUndated(wuppertal, 0, true);

    expect(response.status).toBe(200);
    expect(await ratingOf(wuppertal)).toBeUndefined();
  });

  it('keeps the rating when the undated visits go but a dated one remains', async () => {
    await setUndated(wuppertal, 2);
    await logVisit(wuppertal);
    await rate(wuppertal, { subjective: 7 });

    const { response } = await setUndated(wuppertal, 0);

    expect(response.status).toBe(200);
    expect(await ratingOf(wuppertal)).toBeDefined();
  });

  it('asks for a confirmation before the lived-in mark leaves a rated city without visits', async () => {
    await markLived(wuppertal);
    await rate(wuppertal, { subjective: 9 });

    const { response } = await unmarkLived(wuppertal);

    expect(response.status).toBe(409);
    expect((await ada.GET('/v1/lived-cities')).data?.items).toHaveLength(1);
    expect(await ratingOf(wuppertal)).toBeDefined();
  });

  it('deletes the rating with the lived-in mark once the user has confirmed', async () => {
    await markLived(wuppertal);
    await rate(wuppertal, { subjective: 9 });

    const { response } = await unmarkLived(wuppertal, 'true');

    expect(response.status).toBe(204);
    expect(await ratingOf(wuppertal)).toBeUndefined();
  });

  it('keeps the rating when the lived-in mark goes but a visit remains', async () => {
    await markLived(wuppertal);
    await logVisit(wuppertal);
    await rate(wuppertal, { subjective: 9 });

    const { response } = await unmarkLived(wuppertal);

    expect(response.status).toBe(204);
    expect(await ratingOf(wuppertal)).toBeDefined();
  });

  it('never leaves a rating without a visit when both are changed together', async () => {
    const visit = await logVisit(wuppertal);

    await Promise.all([deleteVisit(visit.id, 'true'), rate(wuppertal, { subjective: 7 })]);

    const visits = await sql`SELECT 1 FROM visits`;
    const ratings = await sql`SELECT 1 FROM city_ratings`;
    expect(ratings.length).toBeLessThanOrEqual(visits.length);
  });
});

describe('Account deletion', () => {
  it('removes the ratings with the user (FR-AUTH-009)', async () => {
    await logVisit(wuppertal);
    await rate(wuppertal, { subjective: 7, criteria: { safety: 8 } });

    await sql`DELETE FROM users WHERE auth_provider_id = 'clerk_ada'`;

    expect(await sql`SELECT 1 FROM city_ratings`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM criterion_ratings`).toHaveLength(0);
  });
});
