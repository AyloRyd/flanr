import { char, integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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
