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
const guest = clientFor(null);

/** Signs in a user, logs a visit to the city and rates it. */
async function rateAs(
  name: string,
  cityId: number,
  subjective: number,
  criteria: Record<string, number> = {},
) {
  const client = clientFor(`${name}-token`);
  await client.POST('/v1/visits', { body: { cityId, date: '2026-05-10' } });
  const { response } = await client.PUT('/v1/cities/{cityId}/rating', {
    params: { path: { cityId } },
    body: { subjective, criteria },
  });
  if (!response.ok) throw new Error(`Rating was not saved: ${response.status}`);
}

const communityRating = (cityId: number, client = guest) =>
  client.GET('/v1/cities/{cityId}/community-rating', { params: { path: { cityId } } });
const criterion = async (key: string) =>
  (await communityRating(wuppertal)).data?.criteria.find((entry) => entry.key === key);

beforeEach(async () => {
  await resetData(sql);
  await resetCriteria(sql);
  await insertCity(sql, wuppertal, 'Wuppertal');
  await insertCity(sql, aachen, 'Aachen');
  for (const name of ['ada', 'bob', 'cleo']) {
    await registerUser(sql, name, '2026-03-01T10:00:00Z');
  }
});
afterAll(async () => {
  await resetData(sql);
  await resetCriteria(sql);
  await sql.end();
});

describe('GET /v1/cities/{cityId}/community-rating (BR-009, FR-CITY-003)', () => {
  it('is 7.83 with 3 ratings for the ratings 7, 8 and 8.5', async () => {
    await rateAs('ada', wuppertal, 7);
    await rateAs('bob', wuppertal, 8);
    await rateAs('cleo', wuppertal, 8.5);

    const { data, response } = await communityRating(wuppertal);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ cityId: wuppertal, average: 7.83, count: 3 });
  });

  it('has no value for a city without ratings', async () => {
    const { data } = await communityRating(wuppertal);

    expect(data).toMatchObject({ average: null, count: 0 });
    expect(data?.criteria).toEqual(
      initialCriteria.map((entry) => ({ ...entry, average: null, count: 0 })),
    );
  });

  it('counts only the ratings of this city', async () => {
    await rateAs('ada', wuppertal, 7);
    await rateAs('bob', aachen, 2);

    const { data } = await communityRating(wuppertal);

    expect(data).toMatchObject({ average: 7, count: 1 });
  });

  it('follows a changed rating (FR-RATE-004)', async () => {
    await rateAs('ada', wuppertal, 7);
    await rateAs('bob', wuppertal, 9);

    await rateAs('ada', wuppertal, 8);

    expect((await communityRating(wuppertal)).data).toMatchObject({ average: 8.5, count: 2 });
  });

  it('follows a deleted rating', async () => {
    await rateAs('ada', wuppertal, 7);
    await rateAs('bob', wuppertal, 9);

    await clientFor('bob-token').DELETE('/v1/cities/{cityId}/rating', {
      params: { path: { cityId: wuppertal } },
    });

    expect((await communityRating(wuppertal)).data).toMatchObject({ average: 7, count: 1 });
  });

  it('is the same for guests and signed-in users and names no user (FR-PRIV-002)', async () => {
    await rateAs('ada', wuppertal, 7, { safety: 8 });

    const forGuest = await communityRating(wuppertal);
    const forUser = await communityRating(wuppertal, clientFor('bob-token'));

    expect(forGuest.data).toEqual(forUser.data);
    expect(Object.keys(forGuest.data ?? {}).sort()).toEqual([
      'average',
      'cityId',
      'count',
      'criteria',
    ]);
    expect(JSON.stringify(forGuest.data)).not.toMatch(/user|ada/i);
  });

  it('answers 404 for a city that does not exist', async () => {
    const { response } = await communityRating(999);

    expect(response.status).toBe(404);
  });
});

describe('Per-criterion community averages (FR-RATE-005)', () => {
  it('shows the average and the count 3 when three users rated public transport', async () => {
    await rateAs('ada', wuppertal, 7, { public_transport: 9 });
    await rateAs('bob', wuppertal, 8, { public_transport: 8, safety: 6 });
    await rateAs('cleo', wuppertal, 8, { public_transport: 8.5 });

    expect(await criterion('public_transport')).toEqual({
      key: 'public_transport',
      name: 'Public transport',
      average: 8.5,
      count: 3,
    });
    expect(await criterion('safety')).toMatchObject({ average: 6, count: 1 });
    expect(await criterion('greenery')).toMatchObject({ average: null, count: 0 });
  });

  it('rounds to two decimal places', async () => {
    await rateAs('ada', wuppertal, 7, { safety: 7 });
    await rateAs('bob', wuppertal, 7, { safety: 7 });
    await rateAs('cleo', wuppertal, 7, { safety: 7.5 });

    expect((await criterion('safety'))?.average).toBe(7.17);
  });

  it('lists the criteria in display order and leaves out one that is switched off', async () => {
    await rateAs('ada', wuppertal, 7, { safety: 7 });
    await sql`UPDATE criteria SET active = false WHERE key = 'safety'`;

    const { data } = await communityRating(wuppertal);

    expect(data?.criteria.map((entry) => entry.key)).toEqual(
      initialCriteria.map((entry) => entry.key).filter((key) => key !== 'safety'),
    );
    // The subjective rating of that user still counts.
    expect(data).toMatchObject({ average: 7, count: 1 });
  });
});
