import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import { createTestApi, resetData } from './api.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);
const guest = createTestApi(sql).clientFor(null);

const square = 'SRID=4326;MULTIPOLYGON(((6.8 50.8, 7.1 50.8, 7.1 51.1, 6.8 51.1, 6.8 50.8)))';
const [nrw, cologneMunicipality] = [1, 1];
const [cologne, worringen, pointOnly] = [1, 2, 3];

const cityOf = (cityId: number) =>
  guest.GET('/v1/cities/{cityId}', { params: { path: { cityId } } });

beforeAll(async () => {
  await resetData(sql);
  await sql`
    INSERT INTO regions (id, osm_type, osm_id, country_code, level, name_local, name_en, boundary)
    OVERRIDING SYSTEM VALUE
    VALUES (${nrw}, 'relation', 62761, 'DE', 1, 'Nordrhein-Westfalen', 'North Rhine-Westphalia', ${square})`;
  await sql`
    INSERT INTO municipalities (id, osm_type, osm_id, country_code, name_local, name_en, boundary)
    OVERRIDING SYSTEM VALUE
    VALUES (${cologneMunicipality}, 'relation', 62578, 'DE', 'Köln', 'Cologne', ${square})`;
  await sql`
    INSERT INTO cities (id, osm_type, osm_id, name_local, name_en, country_code, region_1_id,
      municipality_id, represents_municipality, settlement_type, capital_status, centre, boundary,
      population, population_year, area_km2, wikipedia_url)
    OVERRIDING SYSTEM VALUE VALUES
      (${cologne}, 'relation', 62578, 'Köln', 'Cologne', 'DE', ${nrw}, ${cologneMunicipality}, true,
        'city', 'none', 'SRID=4326;POINT(6.9578 50.9384)', ${square}, 1025523, 2023, 405.02,
        'https://de.wikipedia.org/wiki/K%C3%B6ln'),
      (${worringen}, 'node', 240085843, 'Worringen', 'Worringen', 'DE', ${nrw},
        ${cologneMunicipality}, false, 'village', 'none', 'SRID=4326;POINT(6.86 51.06)', NULL,
        NULL, NULL, NULL, NULL),
      (${pointOnly}, 'node', 1, 'Punkt', 'Punkt', 'DE', NULL, NULL, false, 'hamlet', 'none',
        'SRID=4326;POINT(7 51)', NULL, NULL, NULL, NULL, NULL)`;
});
afterAll(async () => {
  await sql.end();
});

describe('GET /v1/cities/{cityId} (FR-CITY-001, FR-CITY-002)', () => {
  it('shows a guest the data of the city page', async () => {
    const { data, response } = await cityOf(cologne);

    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: cologne,
      name: 'Köln',
      nameEn: 'Cologne',
      settlementType: 'city',
      capitalStatus: 'none',
      country: { code: 'DE', name: 'Germany' },
      region: { id: nrw, name: 'North Rhine-Westphalia' },
      municipality: null,
      centre: { latitude: 50.9384, longitude: 6.9578 },
      boundary: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [6.8, 50.8],
              [7.1, 50.8],
              [7.1, 51.1],
              [6.8, 51.1],
              [6.8, 50.8],
            ],
          ],
        ],
      },
      osm: { type: 'relation', id: 62578 },
      population: 1025523,
      populationYear: 2023,
      areaKm2: expect.closeTo(405.02, 2),
      elevationM: null,
      founded: null,
      wikipediaUrl: 'https://de.wikipedia.org/wiki/K%C3%B6ln',
      website: null,
    });
  });

  it('shows Worringen as a part of Cologne (BR-017)', async () => {
    const { data } = await cityOf(worringen);

    expect(data?.municipality).toEqual({ id: cologneMunicipality, name: 'Köln' });
  });

  it('gives a city mapped as a point no boundary, and no region where there is none', async () => {
    const { data } = await cityOf(pointOnly);

    expect(data).toMatchObject({ boundary: null, region: null, population: null });
  });

  it('answers 404 for an unknown city and 400 for an ID that is not one', async () => {
    expect((await cityOf(999)).response.status).toBe(404);
    const { response } = await guest.GET('/v1/cities/{cityId}', {
      params: { path: { cityId: 'abc' as never } },
    });
    expect(response.status).toBe(400);
  });
});
