import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { listVisibilityEnum } from './visibility.ts';

export const userRoleEnum = pgEnum('user_role', ['user', 'moderator', 'administrator']);

export const profileVisibilityEnum = pgEnum('profile_visibility', ['public', 'private']);

/** A registered user (SRS 5.2). Sign-in data stays with Clerk; this is Flanr's own record. */
export const users = pgTable(
  'users',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    /** Clerk user ID. */
    authProviderId: text('auth_provider_id').notNull().unique(),
    /** Keeps its letter case, but is unique without it, see the index (FR-PROF-001). */
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    homeCityVisible: boolean('home_city_visible').notNull().default(false),
    profileVisibility: profileVisibilityEnum('profile_visibility').notNull().default('public'),
    /** The default lists are not stored as lists, so their visibility is kept here (FR-LIST-005). */
    visitedVisibility: listVisibilityEnum('visited_visibility').notNull().default('public'),
    plannedVisibility: listVisibilityEnum('planned_visibility').notNull().default('public'),
    /** Every account is a registered user; moderator and administrator are added by an administrator (FR-AUTH-010). */
    roles: userRoleEnum('roles')
      .array()
      .notNull()
      .default(sql`'{user}'::user_role[]`),
    /** Basis for BR-002: visits after this moment need a date. */
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_username_lower_idx').on(sql`lower(${table.username})`)],
);
