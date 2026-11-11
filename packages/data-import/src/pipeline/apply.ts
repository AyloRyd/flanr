import type { Sql, TransactionSql } from 'postgres';
import { rebuildTileShapes } from './tile-shapes.ts';

/**
 * Replaces the live city data of one country with staging.city in a single transaction
 * (FR-CITY-006, NFR-REL-002). Cities are matched by their OSM object, so internal IDs and
 * everything linked to them survive. Cities that are no longer in the source are kept and
 * marked with in_source = false.
 *
 * Cities without a first-level region are skipped; validation has already limited how many
 * there may be.
 */
export async function applyCities(sql: Sql, countryCode: string): Promise<void> {
  await sql.begin(async (tx) => {
    await upsertCountry(tx, countryCode);
    await upsertRegions(tx, countryCode);
    await upsertCities(tx, countryCode);
    await replaceCityNames(tx, countryCode);
    await rebuildTileShapes(tx, countryCode);
  });
}

async function upsertCountry(tx: TransactionSql, countryCode: string): Promise<void> {
  await tx`
    INSERT INTO countries (code, osm_id, name_local, name_en, boundary)
    SELECT ${countryCode}, osm_id, name, coalesce(tags->>'name:en', name), geom
    FROM staging.country
    ON CONFLICT (code) DO UPDATE SET
      osm_id = excluded.osm_id, name_local = excluded.name_local, name_en = excluded.name_en,
      boundary = excluded.boundary, updated_at = now()
  `;
}

async function upsertRegions(tx: TransactionSql, countryCode: string): Promise<void> {
  await tx`
    INSERT INTO regions (osm_type, osm_id, wikidata_id, country_code, level, iso_code, name_local, name_en, boundary)
    SELECT osm_type, osm_id, wikidata_id, ${countryCode}, level, iso_code, name_local, name_en, geom
    FROM staging.region
    ON CONFLICT (osm_type, osm_id) DO UPDATE SET
      wikidata_id = excluded.wikidata_id, country_code = excluded.country_code, level = excluded.level,
      iso_code = excluded.iso_code, name_local = excluded.name_local, name_en = excluded.name_en,
      boundary = excluded.boundary, in_source = true, updated_at = now()
  `;
  await tx`
    UPDATE regions r SET in_source = false, updated_at = now()
    WHERE r.country_code = ${countryCode} AND r.in_source
      AND NOT EXISTS (SELECT 1 FROM staging.region s WHERE s.osm_type = r.osm_type AND s.osm_id = r.osm_id)
  `;
}

async function upsertCities(tx: TransactionSql, countryCode: string): Promise<void> {
  await tx`
    INSERT INTO cities (osm_type, osm_id, wikidata_id, name_local, name_en, country_code,
      region_1_id, region_2_id, settlement_type, capital_status, centre, boundary,
      boundary_osm_type, boundary_osm_id, boundary_match, population, population_year, wikipedia_url)
    SELECT c.osm_type, c.osm_id, c.wikidata_id, c.name_local, c.name_en, ${countryCode},
           r1.id, r2.id, c.settlement_type, c.capital_status, c.centre, c.boundary,
           c.boundary_osm_type, c.boundary_osm_id, c.boundary_match, c.population, c.population_year,
           c.wikipedia_url
    FROM staging.city c
    JOIN regions r1 ON r1.osm_type = c.region_1_osm_type AND r1.osm_id = c.region_1_osm_id
    LEFT JOIN regions r2 ON r2.osm_type = c.region_2_osm_type AND r2.osm_id = c.region_2_osm_id
    ON CONFLICT (osm_type, osm_id) DO UPDATE SET
      wikidata_id = excluded.wikidata_id, name_local = excluded.name_local, name_en = excluded.name_en,
      country_code = excluded.country_code, region_1_id = excluded.region_1_id,
      region_2_id = excluded.region_2_id, settlement_type = excluded.settlement_type,
      capital_status = excluded.capital_status, centre = excluded.centre, boundary = excluded.boundary,
      boundary_osm_type = excluded.boundary_osm_type, boundary_osm_id = excluded.boundary_osm_id,
      boundary_match = excluded.boundary_match, population = excluded.population,
      population_year = excluded.population_year, wikipedia_url = excluded.wikipedia_url,
      in_source = true, updated_at = now()
  `;
  await tx`
    UPDATE cities c SET in_source = false, updated_at = now()
    WHERE c.country_code = ${countryCode} AND c.in_source
      AND NOT EXISTS (
        SELECT 1 FROM staging.city s
        WHERE s.osm_type = c.osm_type AND s.osm_id = c.osm_id AND s.region_1_osm_id IS NOT NULL
      )
  `;
}

async function replaceCityNames(tx: TransactionSql, countryCode: string): Promise<void> {
  await tx`
    DELETE FROM city_names n USING cities c
    WHERE n.city_id = c.id AND c.country_code = ${countryCode} AND c.in_source
  `;
  await tx`
    INSERT INTO city_names (city_id, name, lang, kind)
    SELECT DISTINCT c.id, n.name, n.lang, n.kind
    FROM staging.place_name n
    JOIN cities c ON c.osm_type = n.osm_type AND c.osm_id = n.osm_id
    WHERE c.country_code = ${countryCode} AND c.in_source
  `;
}
