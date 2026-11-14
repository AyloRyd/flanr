import { sql } from 'drizzle-orm';
import { index, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { cities } from './cities.ts';
import { users } from './users.ts';
import { listVisibilityEnum } from './visibility.ts';

/**
 * A custom list of a user (SRS 5.2, FR-LIST-003). The default lists Visited and Planned are
 * not stored here, see planned-cities.ts.
 */
export const lists = pgTable(
  'lists',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    visibility: listVisibilityEnum('visibility').notNull().default('public'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('lists_user_idx').on(table.userId),
    // Words of the title or the description, for the list search (FR-SRCH-004). The search
    // query has to write the expression the same way. search_text() comes from migration 0017.
    index('lists_search_idx').using(
      'gin',
      sql`search_text(${table.title} || ' ' || coalesce(${table.description}, '')) gin_trgm_ops`,
    ),
  ],
);

/** A city in a custom list. The primary key keeps a city from being in a list twice (FR-LIST-004). */
export const listEntries = pgTable(
  'list_entries',
  {
    listId: integer('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    cityId: integer('city_id')
      .notNull()
      .references(() => cities.id),
    /** The place in the list, counted from 1 without gaps. */
    position: integer('position').notNull(),
    note: text('note'),
  },
  (table) => [
    primaryKey({ columns: [table.listId, table.cityId] }),
    index('list_entries_position_idx').on(table.listId, table.position),
  ],
);
