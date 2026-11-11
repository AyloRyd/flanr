import {
  char,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

/** External data sources with their licence and required attribution (NFR-LIC-001…003). */
export const dataSources = pgTable('data_sources', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  licence: text('licence').notNull(),
  licenceUrl: text('licence_url').notNull(),
  attribution: text('attribution').notNull(),
});

export const importStatusEnum = pgEnum('import_status', ['running', 'succeeded', 'failed']);

/** One run of a city data import (FR-CITY-006). */
export const importRuns = pgTable('import_runs', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sourceId: text('source_id')
    .notNull()
    .references(() => dataSources.id),
  countryCode: char('country_code', { length: 2 }).notNull(),
  /** Timestamp of the source data, for example the replication timestamp of the OSM extract. */
  sourceTimestamp: timestamp('source_timestamp', { withTimezone: true }),
  status: importStatusEnum('status').notNull().default('running'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  stats: jsonb('stats'),
  error: text('error'),
});

/**
 * Our copy of the Wikidata items that cities link to, reduced to the fields Flanr uses.
 * The import fills it; cities are enriched from it without calling Wikidata (FR-CITY-006).
 */
export const wikidataEntities = pgTable('wikidata_entities', {
  /** Wikidata item ID, for example Q365. */
  id: text('id').primaryKey(),
  labelEn: text('label_en'),
  /** Other names by language code: { "en": ["Koeln"], "de": ["Cöln"] }. */
  aliases: jsonb('aliases').$type<Record<string, string[]>>().notNull(),
  population: integer('population'),
  populationYear: smallint('population_year'),
  areaKm2: real('area_km2'),
  elevationM: integer('elevation_m'),
  website: text('website'),
  founded: smallint('founded'),
  /** Wikipedia article URLs by site: { "enwiki": "https://en.wikipedia.org/wiki/Cologne" }. */
  wikipediaUrls: jsonb('wikipedia_urls').$type<Record<string, string>>().notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});
