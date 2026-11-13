import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { cities } from './cities.ts';
import { users } from './users.ts';

/** BR-006: 1 to 10 in steps of 0.5. */
const onRatingScale = (column: unknown) =>
  sql`${column} BETWEEN 1 AND 10 AND ${column} * 2 = trunc(${column} * 2)`;

/**
 * An aspect of a city that is rated separately (SRS 5.2). Criteria are data, so that
 * administrators can add them without code changes (FR-RATE-006).
 */
export const criteria = pgTable('criteria', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  /** Stable name used by the API, for example "public_transport". */
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  /** A removed criterion is switched off; its ratings stay (FR-RATE-006). */
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull(),
});

/** A user's rating of a city (SRS 5.2). The primary key is BR-008: one per user and city. */
export const cityRatings = pgTable(
  'city_ratings',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cityId: integer('city_id')
      .notNull()
      .references(() => cities.id),
    subjective: numeric('subjective', { precision: 3, scale: 1 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.cityId] }),
    check('city_ratings_subjective_on_scale', onRatingScale(table.subjective)),
    // The community rating reads all ratings of one city (BR-009).
    index('city_ratings_city_idx').on(table.cityId),
  ],
);

/**
 * The optional criteria ratings of a city rating. They cannot exist without the rating
 * (BR-006) and are deleted with it (BR-005).
 */
export const criterionRatings = pgTable(
  'criterion_ratings',
  {
    userId: integer('user_id').notNull(),
    cityId: integer('city_id').notNull(),
    criterionId: integer('criterion_id')
      .notNull()
      .references(() => criteria.id),
    value: numeric('value', { precision: 3, scale: 1 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.cityId, table.criterionId] }),
    foreignKey({
      name: 'criterion_ratings_city_rating_fk',
      columns: [table.userId, table.cityId],
      foreignColumns: [cityRatings.userId, cityRatings.cityId],
    }).onDelete('cascade'),
    check('criterion_ratings_value_on_scale', onRatingScale(table.value)),
    index('criterion_ratings_city_criterion_idx').on(table.cityId, table.criterionId),
  ],
);
