import {
  bigint,
  boolean,
  char,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { multiPolygon, multiPolygonMercator, point } from './geometry.ts';

/** OSM element type: node, way or relation. */
export const osmTypeEnum = pgEnum('osm_type', ['node', 'way', 'relation']);

/** Settlement types that count as a city (BR-001). */
export const settlementTypeEnum = pgEnum('settlement_type', ['city', 'town', 'village', 'hamlet']);

export const capitalStatusEnum = pgEnum('capital_status', ['national', 'regional', 'none']);

export const countries = pgTable('countries', {
  /** ISO 3166-1 alpha-2, upper case. */
  code: char('code', { length: 2 }).primaryKey(),
  osmId: bigint('osm_id', { mode: 'number' }),
  nameLocal: text('name_local').notNull(),
  nameEn: text('name_en').notNull(),
  boundary: multiPolygon('boundary'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Administrative regions. Level 1 is a first-level region (a German state), level 2 the next one down (a district). */
export const regions = pgTable(
  'regions',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    osmType: osmTypeEnum('osm_type').notNull(),
    osmId: bigint('osm_id', { mode: 'number' }).notNull(),
    wikidataId: text('wikidata_id'),
    countryCode: char('country_code', { length: 2 })
      .notNull()
      .references(() => countries.code),
    level: smallint('level').notNull(),
    /** ISO 3166-2 code where one exists, for example DE-NW. */
    isoCode: text('iso_code'),
    nameLocal: text('name_local').notNull(),
    nameEn: text('name_en').notNull(),
    boundary: multiPolygon('boundary').notNull(),
    inSource: boolean('in_source').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('regions_osm_uq').on(t.osmType, t.osmId),
    index('regions_boundary_gix').using('gist', t.boundary),
    check('regions_level_ck', sql`${t.level} in (1, 2)`),
  ],
);

export const cities = pgTable(
  'cities',
  {
    /** Internal ID, stable across imports (FR-CITY-006). */
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    osmType: osmTypeEnum('osm_type').notNull(),
    osmId: bigint('osm_id', { mode: 'number' }).notNull(),
    wikidataId: text('wikidata_id'),
    nameLocal: text('name_local').notNull(),
    nameEn: text('name_en').notNull(),
    countryCode: char('country_code', { length: 2 })
      .notNull()
      .references(() => countries.code),
    region1Id: integer('region_1_id')
      .notNull()
      .references(() => regions.id),
    region2Id: integer('region_2_id').references(() => regions.id),
    settlementType: settlementTypeEnum('settlement_type').notNull(),
    capitalStatus: capitalStatusEnum('capital_status').notNull().default('none'),
    centre: point('centre').notNull(),
    /** Null when OSM has no mapped boundary; the city is then shown as a point (OI-003). */
    boundary: multiPolygon('boundary'),
    /** Which OSM object the boundary comes from, and how it was linked to the settlement. */
    boundaryOsmType: osmTypeEnum('boundary_osm_type'),
    boundaryOsmId: bigint('boundary_osm_id', { mode: 'number' }),
    boundaryMatch: text('boundary_match'),
    population: integer('population'),
    populationYear: smallint('population_year'),
    wikipediaUrl: text('wikipedia_url'),
    /** False when the city is missing from the latest import but kept because data may be linked to it (FR-CITY-006). */
    inSource: boolean('in_source').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cities_osm_uq').on(t.osmType, t.osmId),
    index('cities_country_idx').on(t.countryCode),
    index('cities_region_1_idx').on(t.region1Id),
    // Low-zoom map tiles select the few cities and towns of a large area by type.
    index('cities_settlement_type_idx').on(t.settlementType),
    index('cities_centre_gix').using('gist', t.centre),
    index('cities_boundary_gix').using('gist', t.boundary),
  ],
);

/** Names of a city: local, English, other languages, alternative and historical names. Used by search. */
export const cityNames = pgTable(
  'city_names',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    cityId: integer('city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Language code from the OSM key (name:de → de). Null when the language is unknown. */
    lang: text('lang'),
    /** OSM key family the name comes from: name, alt_name, old_name, official_name, short_name, loc_name, int_name. */
    kind: text('kind').notNull(),
  },
  (t) => [
    index('city_names_city_idx').on(t.cityId),
    unique('city_names_uq').on(t.cityId, t.name, t.kind, t.lang).nullsNotDistinct(),
  ],
);

/**
 * City boundaries simplified for a range of map zooms, in Web Mercator, ready for vector tiles.
 * Rebuilt by the import together with the cities.
 */
export const cityTileShapes = pgTable(
  'city_tile_shapes',
  {
    cityId: integer('city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'cascade' }),
    minZoom: smallint('min_zoom').notNull(),
    maxZoom: smallint('max_zoom').notNull(),
    geom: multiPolygonMercator('geom').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.cityId, t.minZoom] }),
    index('city_tile_shapes_geom_gix').using('gist', t.geom),
  ],
);
