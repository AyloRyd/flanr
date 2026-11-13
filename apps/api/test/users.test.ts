import { checkUsername } from '@flanr/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import { deleteUserByAuthProviderId, ensureUser, syncUserFromClerk } from '../src/users.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);

beforeEach(async () => {
  await sql`TRUNCATE users RESTART IDENTITY CASCADE`;
});
afterAll(async () => {
  await sql.end();
});

describe('ensureUser', () => {
  it('creates a new account with the role registered user only (FR-AUTH-010)', async () => {
    const user = await ensureUser(sql, 'clerk_1');

    expect(user.roles).toEqual(['user']);
    expect(user.username).toMatch(/^user_[0-9a-f]{10}$/);
    expect(checkUsername(user.username)).toBeNull();
    expect(user.displayName).toBe(user.username);
  });

  it('returns the same user on every later request', async () => {
    const first = await ensureUser(sql, 'clerk_1');
    const second = await ensureUser(sql, 'clerk_1');
    const other = await ensureUser(sql, 'clerk_2');

    expect(second).toEqual(first);
    expect(other.id).not.toBe(first.id);
  });
});

describe('syncUserFromClerk (FR-AUTH-003…005)', () => {
  const profile = {
    authProviderId: 'clerk_1',
    username: 'ada',
    displayName: 'Ada Lovelace',
    avatarUrl: 'https://example.com/ada.png',
  };

  it('creates the user from the data Clerk sends', async () => {
    await syncUserFromClerk(sql, profile);

    expect(await ensureUser(sql, 'clerk_1')).toMatchObject({
      username: 'ada',
      displayName: 'Ada Lovelace',
      avatarUrl: 'https://example.com/ada.png',
      roles: ['user'],
    });
  });

  it('gives a user that signed in before the report the names from Clerk, and keeps the ID', async () => {
    const before = await ensureUser(sql, 'clerk_1');

    await syncUserFromClerk(sql, profile);

    expect(await ensureUser(sql, 'clerk_1')).toMatchObject({
      id: before.id,
      username: 'ada',
      displayName: 'Ada Lovelace',
    });
  });

  it('keeps the names the user has in Flanr when Clerk reports a change (FR-PROF-001)', async () => {
    await syncUserFromClerk(sql, profile);

    await syncUserFromClerk(sql, { ...profile, username: 'countess', displayName: 'A. King' });

    expect(await ensureUser(sql, 'clerk_1')).toMatchObject({
      username: 'ada',
      displayName: 'Ada Lovelace',
    });
  });

  it('follows a change of the avatar at Clerk (FR-PROF-002)', async () => {
    await syncUserFromClerk(sql, profile);

    await syncUserFromClerk(sql, { ...profile, avatarUrl: 'https://example.com/new.png' });

    expect((await ensureUser(sql, 'clerk_1')).avatarUrl).toBe('https://example.com/new.png');
  });

  it.each([
    ['is not allowed in Flanr', 'ada-lovelace'],
    ['is reserved', 'admin'],
    ['is taken in another letter case', 'ADA'],
  ])('generates a username when the one from Clerk %s (FR-PROF-001)', async (_case, username) => {
    await syncUserFromClerk(sql, profile);

    await syncUserFromClerk(sql, { ...profile, authProviderId: 'clerk_2', username });

    const user = await ensureUser(sql, 'clerk_2');
    expect(user.username).toMatch(/^user_[0-9a-f]{10}$/);
    expect(user.displayName).toBe('Ada Lovelace');
  });

  it('uses the generated username as display name when Clerk sends no name', async () => {
    await syncUserFromClerk(sql, { ...profile, username: null, displayName: null });

    const user = await ensureUser(sql, 'clerk_1');
    expect(user.displayName).toBe(user.username);
  });

  it('removes the user when the account is deleted', async () => {
    await syncUserFromClerk(sql, profile);

    await deleteUserByAuthProviderId(sql, 'clerk_1');

    expect(await sql`SELECT 1 FROM users`).toHaveLength(0);
  });
});
