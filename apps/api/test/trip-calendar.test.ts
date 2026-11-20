import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import { createTestApi, insertCity, registerUser, resetData } from './api.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);
const [cologne, bonn] = [1, 2];

const { clientFor } = createTestApi(sql);
const ada = clientFor('ada-token');
const bob = clientFor('bob-token');

async function logVisit(client: typeof ada, cityId: number, date: string | null) {
  const { response } = await client.POST('/v1/visits', {
    body: { cityId, date, beforeRegistration: date === null },
  });
  expect(response.status).toBe(201);
}

/** Ada registered on 1 March 2026; the tests run on 12 November 2026. */
beforeEach(async () => {
  await resetData(sql);
  await insertCity(sql, cologne, 'Köln');
  await insertCity(sql, bonn, 'Bonn');
  await registerUser(sql, 'ada', '2026-03-01T10:00:00Z');
  await registerUser(sql, 'bob', '2026-03-01T10:00:00Z');
});
afterAll(async () => {
  await sql.end();
});

describe('GET /v1/trip-calendar (FR-STAT-003)', () => {
  it('places the visits with a day on their days, with the cities of each', async () => {
    await logVisit(ada, cologne, '2026-05-10');
    await logVisit(ada, bonn, '2026-05-10');
    await logVisit(ada, cologne, '2026-07-01');

    const { data } = await ada.GET('/v1/trip-calendar');

    expect(data).toEqual({
      from: '2026-05-10',
      to: '2026-11-13',
      days: [
        { date: '2026-05-10', cityIds: [cologne, bonn] },
        { date: '2026-07-01', cityIds: [cologne] },
      ],
      visitsBefore: 0,
    });
  });

  it('starts on the registration date with undated visits and counts them', async () => {
    await logVisit(ada, cologne, null);
    await logVisit(ada, bonn, null);
    await logVisit(ada, cologne, '2026-06-02');

    const { data } = await ada.GET('/v1/trip-calendar');

    expect(data?.from).toBe('2026-03-01');
    expect(data?.visitsBefore).toBe(2);
  });

  it('has only the visits of the signed-in user (NFR-SEC-003)', async () => {
    await logVisit(ada, cologne, '2026-05-10');

    const { data } = await bob.GET('/v1/trip-calendar');

    expect(data).toEqual({ from: null, to: '2026-11-13', days: [], visitsBefore: 0 });
  });

  it('needs a signed-in user', async () => {
    const { response } = await clientFor(null).GET('/v1/trip-calendar');

    expect(response.status).toBe(401);
  });
});
