import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  integer,
  pgTable,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { cities } from './cities.ts';
import { users } from './users.ts';
import { visitDatePrecisionEnum } from './visits.ts';

/**
 * A city the user lives in or has lived in (SRS 5.2, BR-016). The optional period uses the
 * precision of visit dates: each end is stored as the first day of its period.
 */
export const livedCities = pgTable(
  'lived_cities',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cityId: integer('city_id')
      .notNull()
      .references(() => cities.id),
    isCurrent: boolean('is_current').notNull(),
    fromDate: date('from_date'),
    fromPrecision: visitDatePrecisionEnum('from_precision').notNull().default('none'),
    toDate: date('to_date'),
    toPrecision: visitDatePrecisionEnum('to_precision').notNull().default('none'),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.cityId] }),
    // BR-016: at most one current city per user.
    uniqueIndex('lived_cities_one_current_idx')
      .on(table.userId)
      .where(sql`${table.isCurrent}`),
    check(
      'lived_cities_from_matches_precision',
      sql`(${table.fromPrecision} = 'none') = (${table.fromDate} IS NULL)`,
    ),
    check(
      'lived_cities_to_matches_precision',
      sql`(${table.toPrecision} = 'none') = (${table.toDate} IS NULL)`,
    ),
  ],
);
