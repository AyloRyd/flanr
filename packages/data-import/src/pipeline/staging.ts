import type { Sql } from 'postgres';

/**
 * Staging tables live in their own schema and are rebuilt on every run (FR-CITY-006).
 * They are UNLOGGED because they can always be rebuilt from the source files.
 */
export async function createStaging(sql: Sql): Promise<void> {
  await sql.unsafe(`
    DROP SCHEMA IF EXISTS staging CASCADE;
    CREATE SCHEMA staging;

    CREATE UNLOGGED TABLE staging.place (
      osm_type osm_type NOT NULL,
      osm_id bigint NOT NULL,
      settlement_type settlement_type NOT NULL,
      name text NOT NULL,
      name_en text NOT NULL,
      wikidata_id text,
      population integer,
      population_year smallint,
      capital_status capital_status NOT NULL,
      wikipedia_url text,
      tags jsonb NOT NULL,
      geom geometry(Geometry, 4326) NOT NULL,
      PRIMARY KEY (osm_type, osm_id)
    );

    CREATE UNLOGGED TABLE staging.boundary (
      osm_type osm_type NOT NULL,
      osm_id bigint NOT NULL,
      admin_level smallint,
      name text,
      tags jsonb NOT NULL,
      geom geometry(MultiPolygon, 4326) NOT NULL,
      PRIMARY KEY (osm_type, osm_id)
    );

    CREATE UNLOGGED TABLE staging.boundary_member (
      boundary_osm_id bigint NOT NULL,
      member_type osm_type NOT NULL,
      member_id bigint NOT NULL,
      role text NOT NULL
    );

    CREATE UNLOGGED TABLE staging.place_name (
      osm_type osm_type NOT NULL,
      osm_id bigint NOT NULL,
      name text NOT NULL,
      lang text,
      kind text NOT NULL
    );
  `);
}

export async function dropStaging(sql: Sql): Promise<void> {
  await sql`DROP SCHEMA IF EXISTS staging CASCADE`;
}
