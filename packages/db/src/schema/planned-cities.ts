import { integer, pgTable, primaryKey, timestamp } from 'drizzle-orm/pg-core';
import { cities } from './cities.ts';
import { users } from './users.ts';

/**
 * The Planned list: a set of cities per user (SRS 5.2). The Visited list has no table; it is
 * derived from the visits and the lived-in cities (BR-004).
 */
export const plannedCities = pgTable(
  'planned_cities',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cityId: integer('city_id')
      .notNull()
      .references(() => cities.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.cityId] })],
);
