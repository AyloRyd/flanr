import { sql } from 'drizzle-orm';
import { boolean, integer, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['user', 'moderator', 'administrator']);

export const profileVisibilityEnum = pgEnum('profile_visibility', ['public', 'private']);

/** A registered user (SRS 5.2). Sign-in data stays with Clerk; this is Flanr's own record. */
export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  /** Clerk user ID. */
  authProviderId: text('auth_provider_id').notNull().unique(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  homeCityVisible: boolean('home_city_visible').notNull().default(false),
  profileVisibility: profileVisibilityEnum('profile_visibility').notNull().default('public'),
  /** Every account is a registered user; moderator and administrator are added by an administrator (FR-AUTH-010). */
  roles: userRoleEnum('roles')
    .array()
    .notNull()
    .default(sql`'{user}'::user_role[]`),
  /** Basis for BR-002: visits after this moment need a date. */
  registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
});
