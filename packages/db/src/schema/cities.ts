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
  real,
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

/**
 * The lowest administrative unit with its own local government (Gemeinde, gemeente, commune).
 * Reference data: a city links to its municipality, which cannot be visited itself (BR-017).
 */
export const municipalities = pgTable(
  'municipalities',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    osmType: osmTypeEnum('osm_type').notNull(),
    osmId: bigint('osm_id', { mode: 'number' }).notNull(),
    wikidataId: text('wikidata_id'),
    countryCode: char('country_code', { length: 2 })
      .notNull()
      .references(() => countries.code),
    nameLocal: text('name_local').notNull(),
    nameEn: text('name_en').notNull(),
    boundary: multiPolygon('boundary').notNull(),
    inSource: boolean('in_source').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('municipalities_osm_uq').on(t.osmType, t.osmId),
    index('municipalities_boundary_gix').using('gist', t.boundary),
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
    /** Null in countries without first-level regions, such as Monaco or Vatican City. */
    region1Id: integer('region_1_id').references(() => regions.id),
    region2Id: integer('region_2_id').references(() => regions.id),
    municipalityId: integer('municipality_id').references(() => municipalities.id),
    /** True when the city and its municipality are the same thing, for example Cologne (BR-017). */
    representsMunicipality: boolean('represents_municipality').notNull().default(false),
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
    /** Where the population comes from: openstreetmap or wikidata. */
    populationSource: text('population_source'),
    wikipediaUrl: text('wikipedia_url'),
    areaKm2: real('area_km2'),
    elevationM: integer('elevation_m'),
    website: text('website'),
    /** Year of founding or first mention. Negative for years BCE. */
    founded: smallint('founded'),
    /** False when the city is missing from the latest import but kept because data may be linked to it (FR-CITY-006). */
    inSource: boolean('in_source').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cities_osm_uq').on(t.osmType, t.osmId),
    index('cities_country_idx').on(t.countryCode),
    index('cities_region_1_idx').on(t.region1Id),
    index('cities_municipality_idx').on(t.municipalityId),
    // Low-zoom map tiles select the few cities and towns of a large area by type.
    index('cities_settlement_type_idx').on(t.settlementType),
    // The search sorts thousands of found cities by size; with this index it reads their
    // population without reading the cities themselves.
    index('cities_search_rank_idx')
      .on(t.id, t.population)
      .where(sql`in_source`),
    index('cities_centre_gix').using('gist', t.centre),
    index('cities_boundary_gix').using('gist', t.boundary),
  ],
);

/** Names of a city: local, English, other languages, alternative and historical names. Used by search. */
/**
 * The names a city is known by in some language, as opposed to alternative, former, official
 * and short names and nicknames. Only main names are searched by their beginning and for close
 * spellings; otherwise "St" would find Berlin through "Stadt Berlin". The search query has to
 * repeat this condition word for word to use the partial indexes below.
 */
const isMainCityName = sql`kind in ('name', 'int_name', 'wikidata_label')`;

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
    /**
     * The name as the search compares it: lower case, without diacritics (FR-SRCH-001).
     * search_text() comes from migration 0017.
     */
    searchName: text('search_name')
      .notNull()
      .generatedAlwaysAs(sql`search_text(name)`),
  },
  (t) => [
    index('city_names_city_idx').on(t.cityId),
    // Names that are exactly the query; has the city, so the table is not read.
    index('city_names_search_exact_idx').on(t.searchName.op('text_pattern_ops'), t.cityId),
    // Main names that start with the query.
    index('city_names_search_prefix_idx')
      .on(t.searchName.op('text_pattern_ops'), t.cityId)
      .where(isMainCityName),
    // Main names that are spelled almost like the query.
    index('city_names_search_trgm_idx')
      .using('gin', t.searchName.op('gin_trgm_ops'))
      .where(isMainCityName),
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
