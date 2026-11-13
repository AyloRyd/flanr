import { randomBytes } from 'node:crypto';
import {
  checkUsername,
  type CurrentUser,
  type PublicProfile,
  type UpdateProfile,
  type UserRole,
  type Visibility,
} from '@flanr/shared';
import type { Sql } from './db.ts';

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  home_city_id: number | null;
  home_city_visible: boolean;
  profile_visibility: Visibility;
  visited_visibility: Visibility;
  planned_visibility: Visibility;
  roles: UserRole[];
  registered_at: Date;
}

const toCurrentUser = (row: UserRow): CurrentUser => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
  avatarUrl: row.avatar_url,
  bio: row.bio,
  homeCityId: row.home_city_id,
  homeCityVisible: row.home_city_visible,
  profileVisibility: row.profile_visibility,
  visitedVisibility: row.visited_visibility,
  plannedVisibility: row.planned_visibility,
  roles: row.roles,
  registeredAt: row.registered_at.toISOString(),
});

/** The home location is not stored: it is the current lived-in city (BR-016). */
const userColumns = (sql: Sql) => sql`
  users.id, users.username, users.display_name, users.avatar_url, users.bio,
  (SELECT city_id FROM lived_cities WHERE user_id = users.id AND is_current) AS home_city_id,
  users.home_city_visible, users.profile_visibility, users.visited_visibility,
  users.planned_visibility, users.roles::text[] AS roles, users.registered_at`;

/** A username for an account that has not chosen one yet. The user can change it later. */
const placeholderUsername = () => `user_${randomBytes(5).toString('hex')}`;
const generatedUsernamePattern = '^user_[0-9a-f]{10}$';

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';

/**
 * Returns the user for a Clerk user ID and creates it if this is the first request,
 * so signing in works even before Clerk's webhook has arrived. A new account gets
 * the role registered user only (FR-AUTH-010).
 */
export async function ensureUser(sql: Sql, authProviderId: string): Promise<CurrentUser> {
  const username = placeholderUsername();
  const [row] = await sql<UserRow[]>`
    INSERT INTO users (auth_provider_id, username, display_name)
    VALUES (${authProviderId}, ${username}, ${username})
    ON CONFLICT (auth_provider_id) DO UPDATE SET auth_provider_id = EXCLUDED.auth_provider_id
    RETURNING ${userColumns(sql)}`;
  if (!row) throw new Error('User could not be created');
  return toCurrentUser(row);
}

export interface ClerkProfile {
  authProviderId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/** The username Clerk sends, if Flanr's rules allow it and nobody has it (FR-PROF-001). */
async function usableUsername(sql: Sql, username: string | null): Promise<string | null> {
  if (!username || checkUsername(username)) return null;
  const taken = await sql`SELECT 1 FROM users WHERE lower(username) = lower(${username})`;
  return taken.length > 0 ? null : username;
}

/**
 * Applies what Clerk reports when an account is created or changed. The username and the
 * display name are managed in Flanr: Clerk only supplies the first ones. An account that
 * signed in before this report arrived still has its generated names, and gets Clerk's then.
 * The avatar is Clerk's and follows every change (FR-PROF-001, FR-PROF-002).
 */
export async function syncUserFromClerk(sql: Sql, profile: ClerkProfile): Promise<void> {
  const fromClerk = await usableUsername(sql, profile.username);
  const username = fromClerk ?? placeholderUsername();
  await sql`
    INSERT INTO users (auth_provider_id, username, display_name, avatar_url)
    VALUES (${profile.authProviderId}, ${username}, ${profile.displayName ?? username}, ${profile.avatarUrl})
    ON CONFLICT (auth_provider_id) DO UPDATE SET
      avatar_url = EXCLUDED.avatar_url,
      username = CASE
        WHEN users.username ~ ${generatedUsernamePattern} THEN COALESCE(${fromClerk}::text, users.username)
        ELSE users.username
      END,
      display_name = CASE
        WHEN users.display_name = users.username
          THEN COALESCE(${profile.displayName}::text, ${fromClerk}::text, users.display_name)
        ELSE users.display_name
      END`;
}

export async function deleteUserByAuthProviderId(sql: Sql, authProviderId: string): Promise<void> {
  await sql`DELETE FROM users WHERE auth_provider_id = ${authProviderId}`;
}

/** Whose content a request for another user's lists or ratings is about. */
export interface ContentOwner {
  id: number;
  profileVisibility: Visibility;
  visitedVisibility: Visibility;
  plannedVisibility: Visibility;
}

/** Profiles: the user's own settings and what everyone sees of a user. */
export interface ProfileStore {
  /** Changes the given fields. Another user having the username, in any letter case, is reported. */
  update(userId: number, changes: UpdateProfile): Promise<CurrentUser | 'username_taken'>;
  /** The profile under this username, in any letter case, as others see it. */
  findPublic(username: string): Promise<PublicProfile | null>;
  /** The user under this username, in any letter case, with what decides who sees their content. */
  findContentOwner(username: string): Promise<ContentOwner | null>;
}

export function createProfileStore(sql: Sql): ProfileStore {
  return {
    async update(userId, changes) {
      const columns = {
        ...(changes.username === undefined ? {} : { username: changes.username }),
        ...(changes.displayName === undefined ? {} : { display_name: changes.displayName }),
        ...(changes.bio === undefined ? {} : { bio: changes.bio }),
        ...(changes.homeCityVisible === undefined
          ? {}
          : { home_city_visible: changes.homeCityVisible }),
        ...(changes.profileVisibility === undefined
          ? {}
          : { profile_visibility: changes.profileVisibility }),
        ...(changes.visitedVisibility === undefined
          ? {}
          : { visited_visibility: changes.visitedVisibility }),
        ...(changes.plannedVisibility === undefined
          ? {}
          : { planned_visibility: changes.plannedVisibility }),
      };
      try {
        const [row] =
          Object.keys(columns).length === 0
            ? await sql<UserRow[]>`SELECT ${userColumns(sql)} FROM users WHERE id = ${userId}`
            : await sql<UserRow[]>`
                UPDATE users SET ${sql(columns)} WHERE id = ${userId}
                RETURNING ${userColumns(sql)}`;
        if (!row) throw new Error('User not found');
        return toCurrentUser(row);
      } catch (error) {
        // The unique index on the lower-case username is the only one an update can hit.
        if (isUniqueViolation(error)) return 'username_taken';
        throw error;
      }
    },

    async findContentOwner(username) {
      const [owner] = await sql<ContentOwner[]>`
        SELECT id, profile_visibility AS "profileVisibility",
          visited_visibility AS "visitedVisibility", planned_visibility AS "plannedVisibility"
        FROM users WHERE lower(username) = lower(${username})`;
      return owner ?? null;
    },

    async findPublic(username) {
      const [row] = await sql<UserRow[]>`
        SELECT ${userColumns(sql)} FROM users WHERE lower(username) = lower(${username})`;
      if (!row) return null;
      const isPrivate = row.profile_visibility === 'private';
      return {
        username: row.username,
        displayName: row.display_name,
        isPrivate,
        // FR-PRIV-001: a private profile shows the username and the display name only.
        avatarUrl: isPrivate ? null : row.avatar_url,
        bio: isPrivate ? null : row.bio,
        homeCityId: isPrivate || !row.home_city_visible ? null : row.home_city_id,
      };
    },
  };
}

/** For places that never reach the profiles, such as writing the OpenAPI document. */
export const noProfileStore = new Proxy({} as ProfileStore, {
  get: () => () => {
    throw new Error('Profiles are not available here');
  },
});
