import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import { syncUserFromClerk } from '../src/users.ts';
import { createTestApi, insertCity, resetData } from './api.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);
const wuppertal = 1;

const { clientFor } = createTestApi(sql);
const ada = clientFor('ada-token');
const bob = clientFor('bob-token');
const guest = clientFor(null);

type Changes = NonNullable<Parameters<typeof ada.PATCH<'/v1/me'>>[1]>['body'];
const change = (body: Changes, client = ada) => client.PATCH('/v1/me', { body });
const profileOf = (username: string, client = guest) =>
  client.GET('/v1/users/{username}', { params: { path: { username } } });
const me = async (client = ada) => (await client.GET('/v1/me')).data;

beforeEach(async () => {
  await resetData(sql);
  await insertCity(sql, wuppertal, 'Wuppertal');
  await syncUserFromClerk(sql, {
    authProviderId: 'clerk_ada',
    username: 'Ada_1',
    displayName: 'Ada Lovelace',
    avatarUrl: 'https://example.com/ada.png',
  });
  await syncUserFromClerk(sql, {
    authProviderId: 'clerk_bob',
    username: 'bob',
    displayName: 'Bob',
    avatarUrl: null,
  });
});
afterAll(async () => {
  await sql.end();
});

describe('GET /v1/me', () => {
  it('returns the profile and the settings with their defaults (BR-013, FR-PROF-003)', async () => {
    expect(await me()).toMatchObject({
      username: 'Ada_1',
      displayName: 'Ada Lovelace',
      avatarUrl: 'https://example.com/ada.png',
      bio: null,
      homeCityId: null,
      homeCityVisible: false,
      profileVisibility: 'public',
      visitedVisibility: 'public',
      plannedVisibility: 'public',
    });
  });
});

describe('PATCH /v1/me: username (FR-PROF-001)', () => {
  it('changes the username; the profile moves and the old URL is Not Found', async () => {
    const { data, response } = await change({ username: 'countess' });

    expect(response.status).toBe(200);
    expect(data?.username).toBe('countess');
    expect((await profileOf('countess')).data?.displayName).toBe('Ada Lovelace');
    expect((await profileOf('Ada_1')).response.status).toBe(404);
  });

  it('rejects a username that is taken', async () => {
    const { error, response } = await change({ username: 'bob' });

    expect(response.status).toBe(409);
    expect(error).toMatchObject({ status: 409, title: 'Username taken' });
    expect((await me())?.username).toBe('Ada_1');
  });

  it('rejects ada_1 while another user is Ada_1', async () => {
    const { response } = await change({ username: 'ada_1' }, bob);

    expect(response.status).toBe(409);
  });

  it.each(['ab', 'ada lovelace', 'admin', 'Settings', 'x'.repeat(31), 'ada-1'])(
    'rejects the username %j',
    async (username) => {
      const { response } = await change({ username });

      expect(response.status).toBe(400);
      expect((await me())?.username).toBe('Ada_1');
    },
  );

  it('lets the user change the letter case of their own username', async () => {
    const { data } = await change({ username: 'ADA_1' });

    expect(data?.username).toBe('ADA_1');
  });

  it('frees the old username for others at once', async () => {
    await change({ username: 'countess' });

    const { data } = await change({ username: 'ada_1' }, bob);

    expect(data?.username).toBe('ada_1');
  });

  it('keeps the changed username when Clerk reports the account again', async () => {
    await change({ username: 'countess', displayName: 'The Countess' });

    await syncUserFromClerk(sql, {
      authProviderId: 'clerk_ada',
      username: 'Ada_1',
      displayName: 'Ada Lovelace',
      avatarUrl: null,
    });

    expect(await me()).toMatchObject({ username: 'countess', displayName: 'The Countess' });
  });
});

describe('PATCH /v1/me: profile information (FR-PROF-002)', () => {
  it('sets the display name and the bio, which the profile then shows with the avatar', async () => {
    await change({ displayName: 'Ada, Countess of Lovelace', bio: 'Trams and half-timbering.' });

    expect((await profileOf('Ada_1')).data).toEqual({
      username: 'Ada_1',
      displayName: 'Ada, Countess of Lovelace',
      isPrivate: false,
      avatarUrl: 'https://example.com/ada.png',
      bio: 'Trams and half-timbering.',
      homeCityId: null,
    });
  });

  it('changes only what is given', async () => {
    await change({ bio: 'Trams.' });

    const { data } = await change({ displayName: 'Ada' });

    expect(data).toMatchObject({ username: 'Ada_1', displayName: 'Ada', bio: 'Trams.' });
  });

  it('removes the bio', async () => {
    await change({ bio: 'Trams.' });

    const { data } = await change({ bio: null });

    expect(data?.bio).toBeNull();
  });

  it.each([{ displayName: '' }, { displayName: 'x'.repeat(51) }, { bio: 'x'.repeat(301) }])(
    'rejects %j',
    async (body) => {
      const { response } = await change(body);

      expect(response.status).toBe(400);
    },
  );

  it('changes only the profile of the signed-in user (NFR-SEC-003)', async () => {
    await change({ displayName: 'Robert' }, bob);

    expect((await me())?.displayName).toBe('Ada Lovelace');
  });

  it('needs a signed-in user', async () => {
    const { response } = await change({ displayName: 'Nobody' }, guest);

    expect(response.status).toBe(401);
  });
});

describe('Home location (FR-PROF-003, BR-016)', () => {
  const liveIn = (cityId: number) =>
    ada.PUT('/v1/lived-cities/{cityId}', {
      params: { path: { cityId } },
      body: { isCurrent: true },
    });

  it('is the current lived-in city and is hidden from others by default', async () => {
    await liveIn(wuppertal);

    expect((await me())?.homeCityId).toBe(wuppertal);
    expect((await profileOf('Ada_1', bob)).data?.homeCityId).toBeNull();
  });

  it('is shown to others once the user shows it, and hidden again on request', async () => {
    await liveIn(wuppertal);

    await change({ homeCityVisible: true });
    const shown = await profileOf('Ada_1', bob);
    await change({ homeCityVisible: false });
    const hidden = await profileOf('Ada_1', bob);

    expect(shown.data?.homeCityId).toBe(wuppertal);
    expect(hidden.data?.homeCityId).toBeNull();
  });

  it('is optional: a past lived-in city is not a home location', async () => {
    await ada.PUT('/v1/lived-cities/{cityId}', {
      params: { path: { cityId: wuppertal } },
      body: { isCurrent: false },
    });
    await change({ homeCityVisible: true });

    expect((await me())?.homeCityId).toBeNull();
    expect((await profileOf('Ada_1')).data?.homeCityId).toBeNull();
  });
});

describe('Visibility settings (FR-LIST-005, FR-PRIV-001)', () => {
  it('stores the visibility of the Visited and the Planned list separately', async () => {
    const { data } = await change({ plannedVisibility: 'private' });

    expect(data).toMatchObject({ visitedVisibility: 'public', plannedVisibility: 'private' });
  });

  it('shows only the username and the display name of a private profile', async () => {
    await change({ bio: 'Trams.', homeCityVisible: true, profileVisibility: 'private' });

    expect((await profileOf('Ada_1')).data).toEqual({
      username: 'Ada_1',
      displayName: 'Ada Lovelace',
      isPrivate: true,
      avatarUrl: null,
      bio: null,
      homeCityId: null,
    });
  });

  it('shows the profile again when it is made public', async () => {
    await change({ bio: 'Trams.', profileVisibility: 'private' });

    await change({ profileVisibility: 'public' });

    expect((await profileOf('Ada_1')).data).toMatchObject({ isPrivate: false, bio: 'Trams.' });
  });
});

describe('GET /v1/users/{username} (FR-PROF-004)', () => {
  it('is open to guests and finds the user in any letter case', async () => {
    const { data, response } = await profileOf('ADA_1');

    expect(response.status).toBe(200);
    expect(data?.username).toBe('Ada_1');
  });

  it('does not show settings, roles or internal IDs', async () => {
    const { data } = await profileOf('Ada_1');

    expect(Object.keys(data ?? {}).sort()).toEqual([
      'avatarUrl',
      'bio',
      'displayName',
      'homeCityId',
      'isPrivate',
      'username',
    ]);
  });

  it('answers 404 for a username nobody has', async () => {
    const { response } = await profileOf('nobody');

    expect(response.status).toBe(404);
  });
});
