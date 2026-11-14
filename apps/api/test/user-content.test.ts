import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import { syncUserFromClerk } from '../src/users.ts';
import { createTestApi, insertCity, resetCriteria, resetData } from './api.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);
const [wuppertal, aachen, bonn] = [1, 2, 3];

const { clientFor } = createTestApi(sql);
const ada = clientFor('ada-token');
const bob = clientFor('bob-token');
const guest = clientFor(null);

const user = { params: { path: { username: 'ada' } } };
type Settings = NonNullable<Parameters<typeof ada.PATCH<'/v1/me'>>[1]>['body'];
const set = (body: Settings) => ada.PATCH('/v1/me', { body });

const visitedOf = (client = guest) => client.GET('/v1/users/{username}/visited-cities', user);
const plannedOf = (client = guest) => client.GET('/v1/users/{username}/planned-cities', user);
const ratingsOf = (client = guest) => client.GET('/v1/users/{username}/ratings', user);
const listsOf = (client = guest) => client.GET('/v1/users/{username}/lists', user);
const listOf = (listId: number, client = guest) =>
  client.GET('/v1/users/{username}/lists/{listId}', {
    params: { path: { username: 'ada', listId } },
  });
const entriesOf = (listId: number, client = guest) =>
  client.GET('/v1/users/{username}/lists/{listId}/entries', {
    params: { path: { username: 'ada', listId } },
  });

async function createList(title: string, visibility: 'public' | 'private' = 'public') {
  const { data } = await ada.POST('/v1/lists', { body: { title, visibility } });
  if (!data) throw new Error('List was not created');
  await ada.POST('/v1/lists/{listId}/entries', {
    params: { path: { listId: data.id } },
    body: { cityId: wuppertal, note: 'The Schwebebahn' },
  });
  return data;
}

/** Ada has visited and rated Wuppertal, lives in Bonn without visits, and plans Aachen. */
beforeEach(async () => {
  await resetData(sql);
  await resetCriteria(sql);
  for (const [id, name] of [
    [wuppertal, 'Wuppertal'],
    [aachen, 'Aachen'],
    [bonn, 'Bonn'],
  ] as const) {
    await insertCity(sql, id, name);
  }
  for (const name of ['ada', 'bob']) {
    await syncUserFromClerk(sql, {
      authProviderId: `clerk_${name}`,
      username: name,
      displayName: name,
      avatarUrl: null,
    });
  }
  await ada.POST('/v1/visits', { body: { cityId: wuppertal, date: '2026-05-10' } });
  await ada.PUT('/v1/cities/{cityId}/rating', {
    params: { path: { cityId: wuppertal } },
    body: { subjective: 8, criteria: { public_transport: 10 } },
  });
  await ada.PUT('/v1/lived-cities/{cityId}', {
    params: { path: { cityId: bonn } },
    body: { isCurrent: true },
  });
  await ada.PUT('/v1/planned-cities/{cityId}', { params: { path: { cityId: aachen } } });
});
afterAll(async () => {
  await sql.end();
});

describe('Content of a public profile (FR-PROF-004, BR-013)', () => {
  it('shows the Visited list to guests and other users', async () => {
    const forGuest = await visitedOf();
    const forBob = await visitedOf(bob);

    expect(forGuest.response.status).toBe(200);
    expect(forGuest.data?.items).toEqual([{ cityId: wuppertal }, { cityId: bonn }]);
    expect(forBob.data).toEqual(forGuest.data);
  });

  it('does not say which visited city the user lives in (FR-PROF-003)', async () => {
    const { data } = await visitedOf();

    expect(JSON.stringify(data)).not.toMatch(/livedIn|visitCount/);
  });

  it('shows the Planned list', async () => {
    const { data } = await plannedOf();

    expect(data?.items.map((city) => city.cityId)).toEqual([aachen]);
  });

  it('shows the ratings with their criteria', async () => {
    const { data } = await ratingsOf();

    expect(data?.items).toEqual([
      expect.objectContaining({
        cityId: wuppertal,
        subjective: 8,
        criteria: { public_transport: 10 },
      }),
    ]);
  });

  it('finds the user in any letter case and answers 404 for an unknown one', async () => {
    const path = (username: string) => ({ params: { path: { username } } });

    const upper = await guest.GET('/v1/users/{username}/planned-cities', path('ADA'));
    const unknown = await guest.GET('/v1/users/{username}/planned-cities', path('nobody'));

    expect(upper.response.status).toBe(200);
    expect(unknown.response.status).toBe(404);
  });

  it('is paginated (SRS 6.2)', async () => {
    const page = (cursor?: string) =>
      guest.GET('/v1/users/{username}/visited-cities', {
        params: { path: { username: 'ada' }, query: { limit: 1, cursor } },
      });

    const first = await page();
    const second = await page(first.data?.nextCursor ?? undefined);

    expect(first.data?.items).toEqual([{ cityId: wuppertal }]);
    expect(second.data).toEqual({ items: [{ cityId: bonn }], nextCursor: null });
  });
});

describe('Visibility of the default lists (FR-LIST-005)', () => {
  it('hides a private Visited list and keeps the Planned list', async () => {
    await set({ visitedVisibility: 'private' });

    expect((await visitedOf()).response.status).toBe(403);
    expect((await visitedOf(bob)).response.status).toBe(403);
    expect((await plannedOf()).response.status).toBe(200);
  });

  it('hides a private Planned list and keeps the Visited list', async () => {
    await set({ plannedVisibility: 'private' });

    expect((await plannedOf()).response.status).toBe(403);
    expect((await visitedOf()).response.status).toBe(200);
  });

  it('still shows the owner their own lists', async () => {
    await set({ visitedVisibility: 'private', plannedVisibility: 'private' });

    expect((await ada.GET('/v1/visited-cities')).data?.items).toHaveLength(2);
    expect((await ada.GET('/v1/planned-cities')).data?.items).toHaveLength(1);
  });
});

describe('Custom lists of another user (FR-LIST-005, FR-LIST-006)', () => {
  it('shows a public list with its entries', async () => {
    const list = await createList('Trams');

    expect((await listsOf()).data?.items).toEqual([expect.objectContaining({ title: 'Trams' })]);
    expect((await listOf(list.id)).data).toMatchObject({ title: 'Trams', entryCount: 1 });
    expect((await entriesOf(list.id)).data?.items).toEqual([
      { cityId: wuppertal, position: 1, note: 'The Schwebebahn' },
    ]);
  });

  it('does not show a private list, as if it did not exist', async () => {
    await createList('Trams');
    const secret = await createList('Secret', 'private');

    expect((await listsOf(bob)).data?.items.map((list) => list.title)).toEqual(['Trams']);
    expect((await listOf(secret.id, bob)).response.status).toBe(404);
    expect((await entriesOf(secret.id, bob)).response.status).toBe(404);
  });

  it('hides a list once it is made private and shows it again when public', async () => {
    const list = await createList('Trams');
    const change = (visibility: 'public' | 'private') =>
      ada.PATCH('/v1/lists/{listId}', {
        params: { path: { listId: list.id } },
        body: { visibility },
      });

    await change('private');
    const hidden = await listOf(list.id);
    await change('public');
    const shown = await listOf(list.id);

    expect(hidden.response.status).toBe(404);
    expect(shown.response.status).toBe(200);
  });

  it('answers 404 for the list of someone else under this username', async () => {
    const { data: bobsList } = await bob.POST('/v1/lists', { body: { title: 'Bob' } });

    const { response } = await listOf(bobsList?.id ?? 0);

    expect(response.status).toBe(404);
  });

  it('still shows the owner their private list', async () => {
    const secret = await createList('Secret', 'private');

    const { data } = await ada.GET('/v1/lists/{listId}', {
      params: { path: { listId: secret.id } },
    });

    expect(data?.title).toBe('Secret');
  });
});

describe('A private profile (FR-PRIV-001, FR-PRIV-003)', () => {
  beforeEach(async () => {
    await createList('Trams');
    await set({ profileVisibility: 'private' });
  });

  it('hides its visits, ratings and default lists from guests and other users', async () => {
    for (const client of [guest, bob]) {
      expect((await visitedOf(client)).response.status).toBe(403);
      expect((await plannedOf(client)).response.status).toBe(403);
      expect((await ratingsOf(client)).response.status).toBe(403);
    }
  });

  it('still shows its public custom lists (FR-PRIV-001, FR-LIST-005)', async () => {
    const list = (await ada.GET('/v1/lists')).data?.items[0];

    for (const client of [guest, bob]) {
      expect((await listsOf(client)).data?.items.map(({ title }) => title)).toEqual(['Trams']);
      expect((await listOf(list?.id ?? 0, client)).data?.title).toBe('Trams');
      expect((await entriesOf(list?.id ?? 0, client)).data?.items).toHaveLength(1);
    }
  });

  it('keeps its private custom lists hidden', async () => {
    const secret = await createList('Secret', 'private');

    expect((await listsOf()).data?.items.map(({ title }) => title)).toEqual(['Trams']);
    expect((await listOf(secret.id)).response.status).toBe(404);
  });

  it('says that the profile is private, in Problem Details format', async () => {
    const { error } = await visitedOf();

    expect(error).toMatchObject({ status: 403, title: 'Profile is private' });
  });

  it('still counts its rating in the community rating, without naming the user (FR-PRIV-002)', async () => {
    await bob.POST('/v1/visits', { body: { cityId: wuppertal, date: '2026-06-01' } });
    await bob.PUT('/v1/cities/{cityId}/rating', {
      params: { path: { cityId: wuppertal } },
      body: { subjective: 5 },
    });

    const { data } = await guest.GET('/v1/cities/{cityId}/community-rating', {
      params: { path: { cityId: wuppertal } },
    });

    expect(data).toMatchObject({ average: 6.5, count: 2 });
    expect(JSON.stringify(data)).not.toContain('ada');
  });

  it('still shows the owner everything', async () => {
    expect((await ada.GET('/v1/visited-cities')).data?.items).toHaveLength(2);
    expect((await ada.GET('/v1/ratings')).data?.items).toHaveLength(1);
    expect((await ada.GET('/v1/lists')).data?.items).toHaveLength(1);
  });

  it('shows the content again when the profile is made public', async () => {
    await set({ profileVisibility: 'public' });

    expect((await ratingsOf()).response.status).toBe(200);
  });
});
