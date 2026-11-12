import { randomBytes } from 'node:crypto';
import type { CurrentUser, UserRole } from '@flanr/shared';
import type { Sql } from './db.ts';

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  roles: UserRole[];
}

const toCurrentUser = (row: UserRow): CurrentUser => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
  avatarUrl: row.avatar_url,
  roles: row.roles,
});

/** A username for an account that has not chosen one yet. The user can change it later. */
const placeholderUsername = () => `user-${randomBytes(5).toString('hex')}`;

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
    RETURNING id, username, display_name, avatar_url, roles::text[] AS roles`;
  if (!row) throw new Error('User could not be created');
  return toCurrentUser(row);
}

export interface ClerkProfile {
  authProviderId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/** Applies the profile data Clerk sends when an account is created or changed. */
export async function syncUserFromClerk(sql: Sql, profile: ClerkProfile): Promise<void> {
  const username = profile.username ?? placeholderUsername();
  await sql`
    INSERT INTO users (auth_provider_id, username, display_name, avatar_url)
    VALUES (${profile.authProviderId}, ${username}, ${profile.displayName ?? username}, ${profile.avatarUrl})
    ON CONFLICT (auth_provider_id) DO UPDATE SET
      username = COALESCE(${profile.username}, users.username),
      display_name = COALESCE(${profile.displayName}, users.display_name),
      avatar_url = ${profile.avatarUrl}`;
}

export async function deleteUserByAuthProviderId(sql: Sql, authProviderId: string): Promise<void> {
  await sql`DELETE FROM users WHERE auth_provider_id = ${authProviderId}`;
}
