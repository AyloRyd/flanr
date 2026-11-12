import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
} from 'drizzle-orm/pg-core';
import { cities } from './cities.ts';
import { users } from './users.ts';

export const visitDatePrecisionEnum = pgEnum('visit_date_precision', [
  'day',
  'month',
  'year',
  'none',
]);

/** A visit of a user to a city (SRS 5.2, BR-002, BR-003). */
export const visits = pgTable(
  'visits',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cityId: integer('city_id')
      .notNull()
      .references(() => cities.id),
    /** The first day of the period for month and year precision; null for an undated visit. */
    date: date('date'),
    datePrecision: visitDatePrecisionEnum('date_precision').notNull(),
    /** Whether the visit took place before the user registered. Always true for an undated visit. */
    beforeRegistration: boolean('before_registration').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('visits_user_city_idx').on(table.userId, table.cityId),
    check(
      'visits_date_matches_precision',
      sql`(${table.datePrecision} = 'none') = (${table.date} IS NULL)`,
    ),
    // BR-002: only a visit from before the registration may have no date.
    check(
      'visits_undated_before_registration',
      sql`${table.datePrecision} <> 'none' OR ${table.beforeRegistration}`,
    ),
  ],
);
