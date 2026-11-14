import type { Sql } from 'postgres';
import type { CountryConfig } from '../countries.ts';

/**
 * Turns the staged OSM data into staging.city: one row per settlement inside the country,
 * with its regions and, where one can be found, its boundary.
 */
export async function matchCities(sql: Sql, country: CountryConfig): Promise<void> {
  await addMatchNames(sql, country);
  await indexStaging(sql);
  await selectCountry(sql, country);
  await selectSettlements(sql);
  await selectMunicipalities(sql, country);
  await selectRegions(sql, country);
  await linkBoundaries(sql);
  await buildCities(sql);
}

/**
 * Names under which a boundary can be matched to a settlement: its own name, and the name
 * without a municipality ending such as " Kommune" where the country has those.
 */
async function addMatchNames(sql: Sql, country: CountryConfig): Promise<void> {
  const endings = country.municipalityNameEndings ?? [];
  await sql`
    ALTER TABLE staging.boundary ADD COLUMN match_names text[];
  `;
  await sql`
    UPDATE staging.boundary b SET match_names = ARRAY(
      SELECT DISTINCT variant FROM (
        SELECT b.name AS variant
        UNION ALL
        SELECT left(b.name, length(b.name) - length(ending))
        FROM unnest(${endings}::text[]) AS ending
        WHERE b.name LIKE '%' || ending AND length(b.name) > length(ending)
      ) variants
    )
    WHERE b.name IS NOT NULL
  `;
}

function region1Levels(country: CountryConfig): number[] {
  if (country.region1Level === null) return [];
  return [country.region1Level, ...(country.region1ExtraLevels ?? [])];
}

async function indexStaging(sql: Sql): Promise<void> {
  await sql.unsafe(`
    CREATE INDEX ON staging.boundary USING gist (geom);
    CREATE INDEX ON staging.boundary USING gin (match_names);
    CREATE INDEX ON staging.boundary ((tags->>'wikidata'));
    CREATE INDEX ON staging.boundary_member (member_type, member_id);
    CREATE INDEX ON staging.boundary_member (boundary_osm_id);
    CREATE INDEX ON staging.place_name (osm_type, osm_id);
    ANALYZE staging.place;
    ANALYZE staging.boundary;
    ANALYZE staging.boundary_member;
  `);
}

/**
 * The country boundary, split into small parts so that point-in-polygon tests stay fast.
 *
 * Some extracts have no usable country boundary: the relation of the Netherlands also covers
 * the Caribbean and is cut off by the extract. The boundary is then built from the first-level
 * regions, which are recognised by their ISO 3166-2 code.
 */
async function selectCountry(sql: Sql, country: CountryConfig): Promise<void> {
  await sql`
    CREATE TABLE staging.country AS
    SELECT osm_type, osm_id, name, tags, geom
    FROM staging.boundary
    WHERE admin_level = 2
      AND upper(coalesce(tags->>'ISO3166-1:alpha2', tags->>'ISO3166-1')) = ${country.code}
    ORDER BY ST_Area(geom) DESC
    LIMIT 1
  `;
  const [found] = await sql`SELECT count(*)::int AS count FROM staging.country`;
  if (found?.count !== 1) {
    await sql`
      INSERT INTO staging.country (osm_type, osm_id, name, tags, geom)
      SELECT 'relation', NULL, ${country.name}, ${sql.json({ 'name:en': country.nameEn })},
             ST_Multi(ST_Union(geom))
      FROM staging.boundary
      WHERE admin_level = ANY(${region1Levels(country)}::smallint[])
        AND tags->>'ISO3166-2' LIKE ${country.code + '-%'}
      HAVING count(*) > 0
    `;
    const [built] = await sql`SELECT count(*)::int AS count FROM staging.country`;
    if (built?.count !== 1) {
      throw new Error(`Country boundary for ${country.code} not found in the extract`);
    }
  }
  await sql.unsafe(`
    CREATE TABLE staging.country_part AS
    SELECT ST_Subdivide(geom, 256) AS geom FROM staging.country;
    CREATE INDEX ON staging.country_part USING gist (geom);
  `);
}

/**
 * Settlements whose centre lies inside the country. An extract also contains a strip of the
 * neighbouring countries, which is dropped here.
 *
 * Some settlements are mapped twice: as a node and as an area (often the boundary relation
 * carries the place tag too). The node is kept and the area becomes its boundary.
 */
async function selectSettlements(sql: Sql): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE staging.settlement AS
    SELECT p.osm_type, p.osm_id, p.settlement_type, p.name, p.name_en, p.wikidata_id,
           p.population, p.population_year, p.capital_status, p.wikipedia_url,
           coalesce(b.geom, p.geom) AS geom,
           CASE WHEN p.osm_type = 'node' THEN p.geom ELSE ST_PointOnSurface(coalesce(b.geom, p.geom)) END AS centre
    FROM staging.place p
    LEFT JOIN staging.boundary b ON b.osm_type = p.osm_type AND b.osm_id = p.osm_id
    WHERE EXISTS (
      SELECT 1 FROM staging.country_part c
      WHERE ST_Intersects(c.geom, CASE WHEN p.osm_type = 'node' THEN p.geom
                                       ELSE ST_PointOnSurface(coalesce(b.geom, p.geom)) END)
    );
    ALTER TABLE staging.settlement ADD PRIMARY KEY (osm_type, osm_id);
    CREATE INDEX ON staging.settlement USING gist (centre);

    DELETE FROM staging.settlement area
    WHERE area.osm_type <> 'node'
      AND EXISTS (
        SELECT 1 FROM staging.settlement node
        WHERE node.osm_type = 'node'
          AND (node.name = area.name OR node.wikidata_id = area.wikidata_id)
          AND ST_Covers(area.geom, node.centre)
      );
  `);
}

/**
 * Finds a boundary for each settlement. Candidates in order of trust:
 *   1. the settlement is itself mapped as an area;
 *   2. the boundary has the same Wikidata ID;
 *   3. the settlement node is the label member of a boundary relation;
 *   4. the settlement node is the admin_centre of a boundary with the same name;
 *   5. a boundary with the same name contains the settlement.
 * The Wikidata ID comes before the label, because it says what the settlement is: a town whose
 * item is the municipality gets the municipality's boundary, not that of its core district, so
 * that boundary, population and area describe the same thing (BR-017).
 * Within a method a municipality's boundary wins, then the most specific one (highest
 * admin_level). Warsaw has the same Wikidata ID on its powiat, its gmina and its settlement
 * boundary; it gets the gmina's. The candidate must always contain the settlement's centre.
 *
 * A name alone does not tell a settlement from the area that is named after it or like it.
 * Methods 4 and 5 therefore never take the boundary of a region, unless the region is also a
 * municipality: the province of Ferrara is not the boundary of a hamlet called Ferrara, nor
 * the state of Bavaria that of a hamlet called Bayern. Method 5 also leaves a boundary alone
 * that names another settlement as its centre: the municipality of Time has its seat in Bryne
 * and is not the boundary of the hamlet Time.
 *
 * A boundary is given to one settlement only: the one found by the most trusted method, then
 * the one with the boundary's name, then the larger kind of settlement.
 */
async function linkBoundaries(sql: Sql): Promise<void> {
  const notOnlyARegion = `(
    NOT EXISTS (SELECT 1 FROM staging.region r WHERE r.osm_type = b.osm_type AND r.osm_id = b.osm_id)
    OR EXISTS (SELECT 1 FROM staging.municipality m WHERE m.osm_type = b.osm_type AND m.osm_id = b.osm_id)
  )`;
  await sql.unsafe(`
    CREATE TABLE staging.boundary_candidate AS
    SELECT s.osm_type, s.osm_id, b.osm_type AS b_type, b.osm_id AS b_id, b.admin_level,
           'own_area' AS method, 1 AS priority
    FROM staging.settlement s
    JOIN staging.boundary b ON b.osm_type = s.osm_type AND b.osm_id = s.osm_id
    UNION ALL
    SELECT s.osm_type, s.osm_id, b.osm_type, b.osm_id, b.admin_level, 'label', 3
    FROM staging.settlement s
    JOIN staging.boundary_member m
      ON m.member_type = s.osm_type AND m.member_id = s.osm_id AND m.role = 'label'
    JOIN staging.boundary b ON b.osm_type = 'relation' AND b.osm_id = m.boundary_osm_id
    WHERE ST_Covers(b.geom, s.centre)
    UNION ALL
    SELECT s.osm_type, s.osm_id, b.osm_type, b.osm_id, b.admin_level, 'wikidata', 2
    FROM staging.settlement s
    JOIN staging.boundary b ON b.tags->>'wikidata' = s.wikidata_id
    WHERE ST_Covers(b.geom, s.centre)
    UNION ALL
    SELECT s.osm_type, s.osm_id, b.osm_type, b.osm_id, b.admin_level, 'admin_centre', 4
    FROM staging.settlement s
    JOIN staging.boundary_member m
      ON m.member_type = s.osm_type AND m.member_id = s.osm_id AND m.role = 'admin_centre'
    JOIN staging.boundary b ON b.osm_type = 'relation' AND b.osm_id = m.boundary_osm_id
    WHERE s.name = ANY(b.match_names) AND ST_Covers(b.geom, s.centre)
      AND ${notOnlyARegion}
    UNION ALL
    SELECT s.osm_type, s.osm_id, b.osm_type, b.osm_id, b.admin_level, 'name_and_location', 5
    FROM staging.settlement s
    JOIN staging.boundary b ON b.match_names @> ARRAY[s.name] AND ST_Covers(b.geom, s.centre)
    WHERE coalesce(b.admin_level, 99) > 2
      AND ${notOnlyARegion}
      AND NOT EXISTS (
        SELECT 1 FROM staging.boundary_member centre_of
        JOIN staging.settlement centre
          ON centre.osm_type = centre_of.member_type AND centre.osm_id = centre_of.member_id
        WHERE b.osm_type = 'relation' AND centre_of.boundary_osm_id = b.osm_id
          AND centre_of.role IN ('admin_centre', 'label')
          AND (centre.osm_type, centre.osm_id) <> (s.osm_type, s.osm_id)
      );

    CREATE TABLE staging.boundary_choice AS
    SELECT DISTINCT ON (b_type, b_id) *
    FROM (
      SELECT DISTINCT ON (c.osm_type, c.osm_id) c.*,
             coalesce(s.name = ANY(b.match_names), false) AS same_name,
             array_position(ARRAY['city', 'town', 'village', 'hamlet'], s.settlement_type::text) AS rank
      FROM staging.boundary_candidate c
      JOIN staging.settlement s USING (osm_type, osm_id)
      JOIN staging.boundary b ON b.osm_type = c.b_type AND b.osm_id = c.b_id
      LEFT JOIN staging.municipality m ON m.osm_type = c.b_type AND m.osm_id = c.b_id
      ORDER BY c.osm_type, c.osm_id, c.priority, (m.osm_id IS NOT NULL) DESC,
               c.admin_level DESC NULLS LAST
    ) best
    ORDER BY b_type, b_id, priority, same_name DESC, rank;
  `);
}

async function selectRegions(sql: Sql, country: CountryConfig): Promise<void> {
  const isoPattern = country.code + '-%';
  // First-level regions have an ISO 3166-2 code. This keeps out other things mapped at the
  // same level, such as small islands in Italy.
  const isRegion1 = sql`
    b.admin_level = ANY(${region1Levels(country)}::smallint[]) AND b.tags->>'ISO3166-2' LIKE ${isoPattern}
  `;
  await sql`
    CREATE TABLE staging.region AS
    SELECT b.osm_type, b.osm_id,
           CASE WHEN ${isRegion1} THEN 1 ELSE 2 END::smallint AS level,
           b.name AS name_local,
           coalesce(b.tags->>'name:en', b.name) AS name_en,
           b.tags->>'ISO3166-2' AS iso_code,
           b.tags->>'wikidata' AS wikidata_id,
           b.geom
    FROM staging.boundary b
    WHERE b.name IS NOT NULL
      AND ((${isRegion1}) OR b.admin_level = ${country.region2Level ?? -1})
      AND EXISTS (SELECT 1 FROM staging.country_part c WHERE ST_Intersects(c.geom, ST_PointOnSurface(b.geom)))
  `;
  await sql.unsafe(`
    CREATE TABLE staging.region_part AS
    SELECT osm_type, osm_id, level, ST_Subdivide(geom, 256) AS geom FROM staging.region;
    CREATE INDEX ON staging.region_part USING gist (geom);
  `);
}

/**
 * Municipalities of the country (BR-017). A boundary of a less specific level is a municipality
 * only if no boundary of a more specific level lies inside it.
 */
async function selectMunicipalities(sql: Sql, country: CountryConfig): Promise<void> {
  const levels = country.municipalityLevels;
  await sql`
    CREATE TABLE staging.municipality_candidate AS
    SELECT b.osm_type, b.osm_id, b.admin_level, b.name, b.tags, b.geom,
           ST_PointOnSurface(b.geom) AS inner_point
    FROM staging.boundary b
    WHERE b.admin_level = ANY(${levels}::smallint[]) AND b.name IS NOT NULL
  `;
  await sql.unsafe(`
    CREATE INDEX ON staging.municipality_candidate USING gist (inner_point);

    CREATE TABLE staging.municipality AS
    SELECT m.osm_type, m.osm_id, m.name AS name_local,
           coalesce(m.tags->>'name:en', m.name) AS name_en,
           CASE WHEN m.tags->>'wikidata' ~ '^Q[0-9]+$' THEN m.tags->>'wikidata' END AS wikidata_id,
           m.geom
    FROM staging.municipality_candidate m
    WHERE EXISTS (SELECT 1 FROM staging.country_part c WHERE ST_Intersects(c.geom, m.inner_point))
      AND NOT EXISTS (
        SELECT 1 FROM staging.municipality_candidate finer
        WHERE finer.admin_level > m.admin_level AND ST_Covers(m.geom, finer.inner_point)
      );

    CREATE TABLE staging.municipality_part AS
    SELECT osm_type, osm_id, ST_Subdivide(geom, 256) AS geom FROM staging.municipality;
    CREATE INDEX ON staging.municipality_part USING gist (geom);
  `);
}

async function buildCities(sql: Sql): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE staging.city AS
    SELECT s.osm_type, s.osm_id,
           -- A settlement without a Wikidata ID takes the one of its boundary.
           coalesce(s.wikidata_id, CASE WHEN b.tags->>'wikidata' ~ '^Q[0-9]+$' THEN b.tags->>'wikidata' END) AS wikidata_id,
           s.name AS name_local, s.name_en, s.settlement_type,
           s.capital_status, s.population, s.population_year, s.wikipedia_url, s.centre,
           b.geom AS boundary, bc.b_type AS boundary_osm_type, bc.b_id AS boundary_osm_id,
           bc.method AS boundary_match,
           r1.osm_type AS region_1_osm_type, r1.osm_id AS region_1_osm_id,
           r2.osm_type AS region_2_osm_type, r2.osm_id AS region_2_osm_id,
           m.osm_type AS municipality_osm_type, m.osm_id AS municipality_osm_id,
           -- The city is its municipality when its boundary is the municipality's boundary.
           coalesce(m.osm_type = bc.b_type AND m.osm_id = bc.b_id, false) AS represents_municipality
    FROM staging.settlement s
    LEFT JOIN staging.boundary_choice bc ON bc.osm_type = s.osm_type AND bc.osm_id = s.osm_id
    LEFT JOIN staging.boundary b ON b.osm_type = bc.b_type AND b.osm_id = bc.b_id
    LEFT JOIN LATERAL (
      SELECT osm_type, osm_id FROM staging.region_part r
      WHERE r.level = 1 AND ST_Intersects(r.geom, s.centre) LIMIT 1
    ) r1 ON true
    LEFT JOIN LATERAL (
      SELECT osm_type, osm_id FROM staging.region_part r
      WHERE r.level = 2 AND ST_Intersects(r.geom, s.centre) LIMIT 1
    ) r2 ON true
    LEFT JOIN LATERAL (
      SELECT osm_type, osm_id FROM staging.municipality_part mp
      WHERE ST_Intersects(mp.geom, s.centre) LIMIT 1
    ) m ON true;
    ALTER TABLE staging.city ADD PRIMARY KEY (osm_type, osm_id);
  `);
  await keepOneCityPerWikidataItem(sql);
}

/**
 * A Wikidata item describes one thing, but mappers also put a town's item on its parts: the
 * villages of Homburg carry the item of Homburg and would get its population, its English
 * name and its aliases. Where several settlements have the same item, it stays with the one
 * whose boundary carries it too, and among those with the larger kind of settlement. If that
 * does not single one out, none of them keeps it: no data is better than someone else's.
 */
async function keepOneCityPerWikidataItem(sql: Sql): Promise<void> {
  await sql.unsafe(`
    WITH claim AS (
      SELECT c.osm_type, c.osm_id, c.wikidata_id,
             coalesce(b.tags->>'wikidata' = c.wikidata_id, false) AS on_boundary,
             array_position(ARRAY['city', 'town', 'village', 'hamlet'], c.settlement_type::text) AS rank
      FROM staging.city c
      LEFT JOIN staging.boundary b
        ON b.osm_type = c.boundary_osm_type AND b.osm_id = c.boundary_osm_id
      WHERE c.wikidata_id IS NOT NULL
    ),
    placed AS (
      SELECT *, rank() OVER (PARTITION BY wikidata_id ORDER BY on_boundary DESC, rank) AS place
      FROM claim
    ),
    owner AS (
      SELECT wikidata_id, min(osm_type::text) AS osm_type, min(osm_id) AS osm_id
      FROM placed WHERE place = 1
      GROUP BY wikidata_id HAVING count(*) = 1
    )
    UPDATE staging.city c SET wikidata_id = NULL
    WHERE c.wikidata_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM owner o
        WHERE o.wikidata_id = c.wikidata_id AND o.osm_type = c.osm_type::text AND o.osm_id = c.osm_id
      );
  `);
}
