import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import { createTestApi, resetData } from './api.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);
const { clientFor } = createTestApi(sql);
const guest = clientFor(null);

const square = 'SRID=4326;MULTIPOLYGON(((7 51, 8 51, 8 52, 7 52, 7 51)))';
const [nrw, hesse, vogelsberg] = [1, 2, 3];

/** [id, name, country, first-level region, second-level region, type, population, ratings] */
const cities = [
  [1, 'Köln', 'DE', nrw, null, 'city', 1_000_000, [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 7.5, 8.5]],
  [2, 'Wuppertal', 'DE', nrw, null, 'city', 350_000, [9, 9, 9, 9, 9, 9, 9, 9, 9, 9]],
  [3, 'Aachen', 'DE', nrw, null, 'city', 250_000, [10, 10, 10, 10, 10, 10, 10, 10, 10]],
  [4, 'Frankfurt am Main', 'DE', hesse, null, 'city', 760_000, [6]],
  [5, 'Herbstein', 'DE', hesse, vogelsberg, 'town', 4_800, []],
  [6, 'Stockhausen', 'DE', hesse, vogelsberg, 'village', 500, []],
  [7, 'Lyon', 'FR', null, null, 'city', 520_000, [7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7]],
  [8, 'Weiler', 'DE', nrw, null, 'hamlet', null, []],
] as const;

async function insertFixture() {
  await resetData(sql);
  // Ukraine has no cities here and must not be offered as a filter.
  await sql`INSERT INTO countries (code, name_local, name_en) VALUES
    ('FR', 'France', 'France'), ('UA', 'Україна', 'Ukraine')`;
  await sql`
    INSERT INTO regions (id, osm_type, osm_id, country_code, level, name_local, name_en, boundary)
    OVERRIDING SYSTEM VALUE VALUES
      (${nrw}, 'relation', 101, 'DE', 1, 'Nordrhein-Westfalen', 'North Rhine-Westphalia', ${square}),
      (${hesse}, 'relation', 102, 'DE', 1, 'Hessen', 'Hesse', ${square}),
      (${vogelsberg}, 'relation', 103, 'DE', 2, 'Vogelsbergkreis', 'Vogelsbergkreis', ${square})`;
  // Enough users for the city with the most ratings: one rating per user and city (BR-008).
  const users = await sql<{ id: number }[]>`
    INSERT INTO users (auth_provider_id, username, display_name)
    SELECT 'clerk_rater_' || n, 'rater_' || n, 'Rater ' || n FROM generate_series(1, 12) AS n
    RETURNING id`;
  for (const [id, name, country, region1, region2, type, population, ratings] of cities) {
    await sql`
      INSERT INTO cities (id, osm_type, osm_id, name_local, name_en, country_code, region_1_id,
        region_2_id, settlement_type, centre, population)
      OVERRIDING SYSTEM VALUE
      VALUES (${id}, 'node', ${id}, ${name}, ${name}, ${country}, ${region1}, ${region2},
        ${type}::settlement_type, ST_SetSRID(ST_MakePoint(7, 51), 4326), ${population})`;
    await sql`INSERT INTO city_names (city_id, name, kind) VALUES (${id}, ${name}, 'name')`;
    for (const [index, subjective] of ratings.entries()) {
      await sql`
        INSERT INTO city_ratings (user_id, city_id, subjective)
        VALUES (${users[index]?.id ?? 0}, ${id}, ${subjective})`;
    }
  }
}

type Query = NonNullable<Parameters<typeof guest.GET<'/v1/cities'>>[1]>['params']['query'];
const list = (query: Query = {}) => guest.GET('/v1/cities', { params: { query } });
const names = async (query: Query = {}) =>
  (await list(query)).data?.items.map((city) => city.name) ?? [];

beforeAll(insertFixture);
afterAll(async () => {
  await resetData(sql);
  await sql.end();
});

describe('GET /v1/cities: sorting by community rating (FR-SRCH-003, OI-011)', () => {
  it('lists German cities from the highest community rating', async () => {
    expect(await names({ country: 'DE', sort: 'rating' })).toEqual(['Wuppertal', 'Köln']);
  });

  it('lists a city with 10 ratings and not one with 9, when the user sets no minimum', async () => {
    const found = await names({ sort: 'rating' });

    expect(found).toContain('Wuppertal');
    expect(found).not.toContain('Aachen');
  });

  it('lists a city with a single rating when the user sets the minimum to 1', async () => {
    expect(await names({ sort: 'rating', minRatings: 1 })).toEqual([
      'Aachen',
      'Wuppertal',
      'Köln',
      'Lyon',
      'Frankfurt am Main',
    ]);
  });

  it('lets the user raise the minimum', async () => {
    expect(await names({ sort: 'rating', minRatings: 12 })).toEqual(['Köln']);
  });

  it('lists unrated cities after the rated ones when the minimum is 0', async () => {
    expect(await names({ sort: 'rating', minRatings: 0, country: 'DE' })).toEqual([
      'Aachen',
      'Wuppertal',
      'Köln',
      'Frankfurt am Main',
      'Herbstein',
      'Stockhausen',
      'Weiler',
    ]);
  });

  it('can list from the lowest community rating', async () => {
    expect(await names({ sort: 'rating', order: 'asc' })).toEqual(['Lyon', 'Köln', 'Wuppertal']);
  });

  it('shows the community rating and the number of ratings with each city (BR-009)', async () => {
    const { data } = await list({ sort: 'rating', country: 'DE' });

    expect(data?.items.map((city) => [city.name, city.rating, city.ratingCount])).toEqual([
      ['Wuppertal', 9, 10],
      ['Köln', 8, 12],
    ]);
  });
});

describe('GET /v1/cities: minimum community rating (FR-SRCH-003)', () => {
  it('lists cities with at least this rating and at least 10 ratings', async () => {
    expect(await names({ minRating: 8, sort: 'name' })).toEqual(['Köln', 'Wuppertal']);
    expect(await names({ minRating: 8.5 })).toEqual(['Wuppertal']);
  });

  it('follows the minimum number of ratings the user sets', async () => {
    expect(await names({ minRating: 9.5, minRatings: 1 })).toEqual(['Aachen']);
    expect(await names({ minRating: 9.5 })).toEqual([]);
  });
});

describe('GET /v1/cities: other sortings (FR-SRCH-003)', () => {
  it('lists all cities by population when nothing is asked for, unknown population last', async () => {
    expect(await names()).toEqual([
      'Köln',
      'Frankfurt am Main',
      'Lyon',
      'Wuppertal',
      'Aachen',
      'Herbstein',
      'Stockhausen',
      'Weiler',
    ]);
  });

  it('sorts by population from the smallest', async () => {
    expect((await names({ sort: 'population', order: 'asc' })).slice(0, 2)).toEqual([
      'Stockhausen',
      'Herbstein',
    ]);
  });

  it('sorts by the number of ratings, without a minimum', async () => {
    expect((await names({ sort: 'ratings' })).slice(0, 6)).toEqual([
      'Köln',
      'Lyon',
      'Wuppertal',
      'Aachen',
      'Frankfurt am Main',
      'Herbstein',
    ]);
  });

  it('sorts by name', async () => {
    expect(await names({ sort: 'name' })).toEqual([
      'Aachen',
      'Frankfurt am Main',
      'Herbstein',
      'Köln',
      'Lyon',
      'Stockhausen',
      'Weiler',
      'Wuppertal',
    ]);
    expect((await names({ sort: 'name', order: 'desc' }))[0]).toBe('Wuppertal');
  });

  it('cannot sort by relevance without a search text', async () => {
    const { error, response } = await list({ sort: 'relevance' });

    expect(response.status).toBe(400);
    expect(error?.errors?.[0]?.path).toBe('sort');
  });
});

describe('GET /v1/cities: filters (FR-SRCH-003)', () => {
  it('filters by country, in any letter case', async () => {
    expect(await names({ country: 'fr' })).toEqual(['Lyon']);
  });

  it('filters by a first-level region', async () => {
    expect(await names({ regionId: hesse })).toEqual([
      'Frankfurt am Main',
      'Herbstein',
      'Stockhausen',
    ]);
  });

  it('filters by a second-level region', async () => {
    expect(await names({ regionId: vogelsberg })).toEqual(['Herbstein', 'Stockhausen']);
  });

  it('filters by one settlement type or several', async () => {
    expect(await names({ settlementType: 'town' })).toEqual(['Herbstein']);
    expect(await names({ settlementType: 'town,village,hamlet' })).toEqual([
      'Herbstein',
      'Stockhausen',
      'Weiler',
    ]);
  });

  it('filters by a population range and leaves out cities of unknown population', async () => {
    expect(await names({ populationMin: 300_000, populationMax: 800_000 })).toEqual([
      'Frankfurt am Main',
      'Lyon',
      'Wuppertal',
    ]);
    expect(await names({ populationMax: 1000 })).toEqual(['Stockhausen']);
  });

  it('combines filters', async () => {
    expect(
      await names({ country: 'DE', settlementType: 'city', populationMax: 500_000, sort: 'name' }),
    ).toEqual(['Aachen', 'Wuppertal']);
  });

  it('rejects a population range that ends below its start', async () => {
    const { response } = await list({ populationMin: 5000, populationMax: 1000 });

    expect(response.status).toBe(400);
  });

  it('is paginated (SRS 6.2)', async () => {
    const first = await list({ sort: 'name', limit: 3 });
    const second = await list({ sort: 'name', limit: 3, cursor: first.data?.nextCursor ?? '' });

    expect(first.data?.items.map((city) => city.name)).toEqual([
      'Aachen',
      'Frankfurt am Main',
      'Herbstein',
    ]);
    expect(second.data?.items.map((city) => city.name)).toEqual(['Köln', 'Lyon', 'Stockhausen']);
  });
});

describe('GET /v1/cities: a name search with filters and sorting', () => {
  it('filters what the search text finds', async () => {
    expect(await names({ q: 'Stock' })).toEqual(['Stockhausen']);
    expect(await names({ q: 'Stock', country: 'FR' })).toEqual([]);
    expect(await names({ q: 'Stock', regionId: vogelsberg })).toEqual(['Stockhausen']);
  });

  it('sorts what the search text finds by something other than relevance', async () => {
    await sql`INSERT INTO city_names (city_id, name, kind) VALUES (2, 'Aachen-Tal', 'name')`;

    const byRelevance = await names({ q: 'Aachen' });
    const byPopulation = await names({ q: 'Aachen', sort: 'population' });
    await sql`DELETE FROM city_names WHERE name = 'Aachen-Tal'`;

    expect(byRelevance).toEqual(['Aachen', 'Wuppertal']);
    expect(byPopulation).toEqual(['Wuppertal', 'Aachen']);
  });

  it('has no minimum number of ratings for a plain name search', async () => {
    expect(await names({ q: 'Frankfurt' })).toEqual(['Frankfurt am Main']);
  });
});

describe('GET /v1/countries and /v1/countries/{code}/regions (FR-SRCH-003)', () => {
  it('lists the countries that have cities, by English name', async () => {
    const { data } = await guest.GET('/v1/countries');

    expect(data?.items).toEqual([
      { code: 'FR', name: 'France', nameLocal: 'France' },
      { code: 'DE', name: 'Germany', nameLocal: 'Deutschland' },
    ]);
  });

  it('lists the regions of a country, first level first', async () => {
    const { data } = await guest.GET('/v1/countries/{code}/regions', {
      params: { path: { code: 'de' } },
    });

    expect(data?.items).toEqual([
      { id: hesse, name: 'Hesse', nameLocal: 'Hessen', level: 1 },
      { id: nrw, name: 'North Rhine-Westphalia', nameLocal: 'Nordrhein-Westfalen', level: 1 },
      { id: vogelsberg, name: 'Vogelsbergkreis', nameLocal: 'Vogelsbergkreis', level: 2 },
    ]);
  });

  it('lists nothing for a country without regions or an unknown one', async () => {
    const { data } = await guest.GET('/v1/countries/{code}/regions', {
      params: { path: { code: 'FR' } },
    });

    expect(data?.items).toEqual([]);
  });
});
