import { prepareTestDatabase } from '@flanr/db/testing';
import postgres from 'postgres';

/**
 * The database of the API that the end-to-end tests start. It is its own database, so the tests
 * never touch the development data, and it holds only the made-up cities below.
 */
export const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ?? 'postgres://flanr:flanr@localhost:5433/flanr_test_e2e';

/** Cities of the end-to-end tests. Made up around real places; not the owner's travel data. */
export const e2eCities = {
  /** A city that is its own municipality, with three ratings: 7, 8 and 8.5 (FR-CITY-003). */
  cologne: 1,
  /** A part of Cologne (BR-017). */
  worringen: 2,
  /** A hamlet mapped as a point only, without a population and without ratings. */
  point: 3,
  /** A city that the tests of the user's own data visit and rate, so other tests never see it. */
  ownData: 4,
  /** A city that only the tests of the visit form log visits to. */
  visits: 5,
  /** A city that the tests of the rating form rate. */
  rating: 6,
  /** A visited city that is never rated, so the rating form always opens empty. */
  unrated: 7,
  /**
   * Cities whose visits and rating the tests of managing visits reset and change. Each run of
   * the file under --repeat-each takes its own, so that runs at the same time do not meet.
   */
  manageVisits: [8, 9],
} as const;

const square = 'SRID=4326;MULTIPOLYGON(((6.8 50.8, 7.1 50.8, 7.1 51.1, 6.8 51.1, 6.8 50.8)))';

/** Brings the database to the latest migration and replaces its data with the test cities. */
export async function seedE2eDatabase(): Promise<void> {
  await prepareTestDatabase(e2eDatabaseUrl);
  const sql = postgres(e2eDatabaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      await tx`TRUNCATE users, city_tile_shapes, city_names, cities, municipalities, regions, countries RESTART IDENTITY CASCADE`;
      await tx`INSERT INTO countries (code, name_local, name_en) VALUES ('DE', 'Deutschland', 'Germany')`;
      await tx`
        INSERT INTO regions (id, osm_type, osm_id, country_code, level, name_local, name_en, boundary)
        OVERRIDING SYSTEM VALUE
        VALUES (1, 'relation', 62761, 'DE', 1, 'Nordrhein-Westfalen', 'North Rhine-Westphalia', ${square})`;
      await tx`
        INSERT INTO municipalities (id, osm_type, osm_id, country_code, name_local, name_en, boundary)
        OVERRIDING SYSTEM VALUE VALUES (1, 'relation', 62578, 'DE', 'Köln', 'Cologne', ${square})`;
      await tx`
        INSERT INTO cities (id, osm_type, osm_id, name_local, name_en, country_code, region_1_id,
          municipality_id, represents_municipality, settlement_type, centre, boundary, population,
          population_year, area_km2, elevation_m, wikipedia_url)
        OVERRIDING SYSTEM VALUE VALUES
          (${e2eCities.cologne}, 'relation', 62578, 'Köln', 'Cologne', 'DE', 1, 1, true, 'city',
            'SRID=4326;POINT(6.9578 50.9384)', ${square}, 1000000, 2024, 400, 53,
            'https://de.wikipedia.org/wiki/K%C3%B6ln'),
          (${e2eCities.worringen}, 'node', 240085843, 'Worringen', 'Worringen', 'DE', 1, 1, false,
            'village', 'SRID=4326;POINT(6.86 51.06)', NULL, 9000, NULL, NULL, NULL, NULL),
          (${e2eCities.point}, 'node', 1, 'Punkt', 'Punkt', 'DE', 1, NULL, false, 'hamlet',
            'SRID=4326;POINT(7 51)', NULL, NULL, NULL, NULL, NULL, NULL),
          (${e2eCities.ownData}, 'node', 2, 'Aachen', 'Aachen', 'DE', 1, NULL, false, 'city',
            'SRID=4326;POINT(6.08 50.78)', NULL, NULL, NULL, NULL, NULL, NULL),
          (${e2eCities.visits}, 'node', 3, 'Bonn', 'Bonn', 'DE', 1, NULL, false, 'city',
            'SRID=4326;POINT(7.1 50.73)', NULL, NULL, NULL, NULL, NULL, NULL),
          (${e2eCities.rating}, 'node', 4, 'Siegburg', 'Siegburg', 'DE', 1, NULL, false, 'town',
            'SRID=4326;POINT(7.2 50.8)', NULL, NULL, NULL, NULL, NULL, NULL),
          (${e2eCities.unrated}, 'node', 5, 'Brühl', 'Brühl', 'DE', 1, NULL, false, 'town',
            'SRID=4326;POINT(6.9 50.83)', NULL, NULL, NULL, NULL, NULL, NULL),
          (${e2eCities.manageVisits[0]}, 'node', 6, 'Hürth', 'Hürth', 'DE', 1, NULL, false, 'town',
            'SRID=4326;POINT(6.87 50.87)', NULL, NULL, NULL, NULL, NULL, NULL),
          (${e2eCities.manageVisits[1]}, 'node', 7, 'Kerpen', 'Kerpen', 'DE', 1, NULL, false, 'town',
            'SRID=4326;POINT(6.7 50.87)', NULL, NULL, NULL, NULL, NULL, NULL)`;
      for (const [index, subjective] of [7, 8, 8.5].entries()) {
        const [user] = await tx<{ id: number }[]>`
          INSERT INTO users (auth_provider_id, username, display_name)
          VALUES (${`e2e_rater_${index}`}, ${`rater_${index}`}, ${`Rater ${index}`})
          RETURNING id`;
        await tx`
          INSERT INTO city_ratings (user_id, city_id, subjective)
          VALUES (${user?.id ?? 0}, ${e2eCities.cologne}, ${subjective})`;
      }
    });
  } finally {
    await sql.end();
  }
}
