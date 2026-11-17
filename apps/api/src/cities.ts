import type { CityDetails, CitySummary } from '@flanr/shared';
import type { TransactionSql } from 'postgres';
import type { Sql } from './db.ts';

export async function cityExists(sql: Sql | TransactionSql, cityId: number): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM cities WHERE id = ${cityId}`;
  return rows.length > 0;
}

/** Reads cities for the city page (FR-CITY-001, FR-CITY-002). */
export interface CityStore {
  /** Null if there is no such city. */
  find(cityId: number): Promise<CityDetails | null>;
  /** The cities with these IDs in the same order; IDs of no city are left out. */
  summaries(cityIds: number[]): Promise<CitySummary[]>;
}

/**
 * Boundaries are simplified to about 10 m before they are sent: a city page does not need the
 * full detail, and some boundaries have tens of thousands of points.
 */
const boundaryTolerance = 0.0001;

export function createCityStore(sql: Sql): CityStore {
  return {
    async find(cityId) {
      const [city] = await sql<CityDetails[]>`
        SELECT c.id, c.name_local AS name, c.name_en AS "nameEn",
          c.settlement_type AS "settlementType", c.capital_status AS "capitalStatus",
          json_build_object('code', country.code, 'name', country.name_en) AS country,
          CASE WHEN region.id IS NULL THEN NULL
            ELSE json_build_object('id', region.id, 'name', region.name_en) END AS region,
          CASE WHEN municipality.id IS NULL OR c.represents_municipality THEN NULL
            ELSE json_build_object('id', municipality.id, 'name', municipality.name_local)
          END AS municipality,
          json_build_object('latitude', ST_Y(c.centre), 'longitude', ST_X(c.centre)) AS centre,
          ST_AsGeoJSON(ST_Multi(ST_SimplifyPreserveTopology(c.boundary, ${boundaryTolerance})), 6)::json
            AS boundary,
          json_build_object('type', c.osm_type, 'id', c.osm_id) AS osm,
          c.population, c.population_year AS "populationYear", c.area_km2::float8 AS "areaKm2",
          c.elevation_m AS "elevationM", c.founded, c.wikipedia_url AS "wikipediaUrl",
          c.website
        FROM cities c
        JOIN countries country ON country.code = c.country_code
        LEFT JOIN regions region ON region.id = c.region_1_id
        LEFT JOIN municipalities municipality ON municipality.id = c.municipality_id
        WHERE c.id = ${cityId}`;
      return city ?? null;
    },

    async summaries(cityIds) {
      return sql<CitySummary[]>`
        SELECT c.id, c.name_local AS name, c.name_en AS "nameEn",
          c.settlement_type AS "settlementType", c.population,
          json_build_object('code', country.code, 'name', country.name_en) AS country,
          region.name_en AS region,
          CASE WHEN c.represents_municipality THEN NULL ELSE municipality.name_local END
            AS municipality,
          community.rating, community.rating_count AS "ratingCount"
        FROM unnest(${cityIds}::int[]) WITH ORDINALITY AS wanted(id, position)
        JOIN cities c ON c.id = wanted.id
        JOIN countries country ON country.code = c.country_code
        LEFT JOIN regions region ON region.id = c.region_1_id
        LEFT JOIN municipalities municipality ON municipality.id = c.municipality_id
        CROSS JOIN LATERAL (
          SELECT round(avg(subjective), 2)::float8 AS rating, count(*)::int AS rating_count
          FROM city_ratings WHERE city_id = c.id
        ) AS community
        ORDER BY wanted.position`;
    },
  };
}

/** For places that never read cities, such as writing the OpenAPI document. */
export const noCityStore: CityStore = {
  find: () => {
    throw new Error('Cities are not available here');
  },
  summaries: () => {
    throw new Error('Cities are not available here');
  },
};
