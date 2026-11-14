import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import { syncUserFromClerk } from '../src/users.ts';
import { createTestApi, insertCity, resetData } from './api.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);
const [wuppertal, aachen] = [1, 2];

const { clientFor } = createTestApi(sql);
const ada = clientFor('ada-token');
const bob = clientFor('bob-token');
const guest = clientFor(null);

type NewList = NonNullable<Parameters<typeof ada.POST<'/v1/lists'>>[1]>['body'];

async function createList(client: typeof ada, body: NewList, cityIds: number[] = []) {
  const { data } = await client.POST('/v1/lists', { body });
  if (!data) throw new Error('List was not created');
  for (const cityId of cityIds) {
    await client.POST('/v1/lists/{listId}/entries', {
      params: { path: { listId: data.id } },
      body: { cityId },
    });
  }
  return data;
}

const search = (q: string, client = guest, query: { limit?: number; cursor?: string } = {}) =>
  client.GET('/v1/public-lists', { params: { query: { q, ...query } } });

const titlesFor = async (q: string, client = guest) =>
  (await search(q, client)).data?.items.map((list) => list.title);

beforeEach(async () => {
  await resetData(sql);
  await insertCity(sql, wuppertal, 'Wuppertal');
  await insertCity(sql, aachen, 'Aachen');
  for (const name of ['ada', 'bob']) {
    await syncUserFromClerk(sql, {
      authProviderId: `clerk_${name}`,
      username: name,
      displayName: name === 'ada' ? 'Ada Lovelace' : 'Bob',
      avatarUrl: null,
    });
  }
});
afterAll(async () => {
  await sql.end();
});

describe('GET /v1/public-lists (FR-SRCH-004, FR-LIST-006)', () => {
  it('finds a public list by its title for a guest', async () => {
    const list = await createList(ada, { title: 'Half-timbered towns' }, [wuppertal]);

    const { data, response } = await search('half-timbered');

    expect(response.status).toBe(200);
    expect(data).toEqual({
      items: [
        {
          ...list,
          entryCount: 1,
          owner: { username: 'ada', displayName: 'Ada Lovelace' },
        },
      ],
      nextCursor: null,
    });
  });

  it('finds a list by its description', async () => {
    await createList(ada, { title: 'Weekend trips', description: 'Old towns with timber framing' });

    expect(await titlesFor('timber')).toEqual(['Weekend trips']);
  });

  it('ignores letter case and diacritics, in the query and in the list', async () => {
    await createList(ada, { title: 'Städte am Rhein' });

    expect(await titlesFor('STADTE')).toEqual(['Städte am Rhein']);
    expect(await titlesFor('rhéin')).toEqual(['Städte am Rhein']);
  });

  it('needs every word, in any order and in title or description together', async () => {
    await createList(ada, { title: 'Tram cities', description: 'Mostly in Germany' });
    await createList(ada, { title: 'Tram museums' });

    expect(await titlesFor('germany tram')).toEqual(['Tram cities']);
    expect(await titlesFor('tram')).toHaveLength(2);
    expect(await titlesFor('tram paris')).toEqual([]);
  });

  it('finds a word inside a longer word', async () => {
    await createList(ada, { title: 'Half-timbered towns' });

    expect(await titlesFor('timber')).toEqual(['Half-timbered towns']);
  });

  it('treats pattern characters in the query as separators', async () => {
    await createList(ada, { title: 'Towns' });

    expect((await search('%')).response.status).toBe(400);
    expect((await search('_')).response.status).toBe(400);
    expect(await titlesFor('tow%')).toEqual(['Towns']);
  });

  it('puts lists with all words in the title first, then the longer lists', async () => {
    await createList(ada, { title: 'Favourites', description: 'Tram towns' }, [wuppertal, aachen]);
    await createList(ada, { title: 'Tram towns' });
    await createList(bob, { title: 'Tram towns of the Ruhr' }, [wuppertal]);

    expect(await titlesFor('tram')).toEqual(['Tram towns of the Ruhr', 'Tram towns', 'Favourites']);
  });

  it('does not find private lists, not even for their owner (FR-LIST-005)', async () => {
    await createList(ada, { title: 'Secret towns', visibility: 'private' });

    expect(await titlesFor('secret')).toEqual([]);
    expect(await titlesFor('secret', ada)).toEqual([]);
  });

  it('does not find the lists of a private profile (FR-PRIV-001, FR-PRIV-003)', async () => {
    await createList(ada, { title: 'Ada towns' });
    await createList(bob, { title: 'Bob towns' });
    await ada.PATCH('/v1/me', { body: { profileVisibility: 'private' } });

    expect(await titlesFor('towns', bob)).toEqual(['Bob towns']);
  });

  it('finds a list again once it is made public', async () => {
    const list = await createList(ada, { title: 'Spa towns', visibility: 'private' });
    await ada.PATCH('/v1/lists/{listId}', {
      params: { path: { listId: list.id } },
      body: { visibility: 'public' },
    });

    expect(await titlesFor('spa')).toEqual(['Spa towns']);
  });

  it('is paginated (SRS 6.2)', async () => {
    await createList(ada, { title: 'Towns one' });
    await createList(ada, { title: 'Towns two' });

    const first = await search('towns', guest, { limit: 1 });
    const second = await search('towns', guest, { limit: 1, cursor: first.data?.nextCursor ?? '' });

    expect(first.data?.items.map((list) => list.title)).toEqual(['Towns two']);
    expect(second.data?.items.map((list) => list.title)).toEqual(['Towns one']);
    expect(second.data?.nextCursor).toBeNull();
  });

  it.each(['', '   ', '-–!', 'x'.repeat(101)])(
    'rejects the query %j in Problem Details format',
    async (q) => {
      const { error, response } = await search(q);

      expect(response.status).toBe(400);
      expect(error).toMatchObject({ status: 400 });
    },
  );

  it('rejects an invalid cursor', async () => {
    const { response } = await search('towns', guest, { cursor: 'abc' });

    expect(response.status).toBe(400);
  });
});
