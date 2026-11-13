import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSql } from '../src/db.ts';
import { createTestApi, insertCity, registerUser, resetData } from './api.ts';
import { testDatabaseUrl } from './database.ts';

const sql = createSql(testDatabaseUrl);
const [wuppertal, aachen, bonn, kassel] = [1, 2, 3, 4];

const { clientFor } = createTestApi(sql);
const ada = clientFor('ada-token');
const bob = clientFor('bob-token');

async function createList(title = 'Cities with the best tram networks', client = ada) {
  const { data } = await client.POST('/v1/lists', { body: { title } });
  if (!data) throw new Error('List was not created');
  return data;
}

const addEntry = (listId: number, cityId: number, note?: string, client = ada) =>
  client.POST('/v1/lists/{listId}/entries', {
    params: { path: { listId } },
    body: { cityId, note },
  });
const changeEntry = (
  listId: number,
  cityId: number,
  body: { note?: string | null; position?: number },
  client = ada,
) =>
  client.PATCH('/v1/lists/{listId}/entries/{cityId}', {
    params: { path: { listId, cityId } },
    body,
  });
const removeEntry = (listId: number, cityId: number, client = ada) =>
  client.DELETE('/v1/lists/{listId}/entries/{cityId}', { params: { path: { listId, cityId } } });
const entries = async (listId: number, client = ada) =>
  (await client.GET('/v1/lists/{listId}/entries', { params: { path: { listId } } })).data?.items;
const order = async (listId: number) => (await entries(listId))?.map((entry) => entry.cityId);
const positions = async (listId: number) => (await entries(listId))?.map((entry) => entry.position);
const myLists = async (client = ada) => (await client.GET('/v1/lists')).data?.items;

/** A list with Wuppertal, Aachen and Bonn, in this order. */
async function listOfThree() {
  const list = await createList();
  for (const cityId of [wuppertal, aachen, bonn]) await addEntry(list.id, cityId);
  return list;
}

beforeEach(async () => {
  await resetData(sql);
  await insertCity(sql, wuppertal, 'Wuppertal');
  await insertCity(sql, aachen, 'Aachen');
  await insertCity(sql, bonn, 'Bonn');
  await insertCity(sql, kassel, 'Kassel');
  await registerUser(sql, 'ada', '2026-03-01T10:00:00Z');
  await registerUser(sql, 'bob', '2026-01-01T10:00:00Z');
});
afterAll(async () => {
  await sql.end();
});

describe('POST /v1/lists (FR-LIST-003)', () => {
  it('creates a list that then is among the lists of the user', async () => {
    const { data, response } = await ada.POST('/v1/lists', {
      body: { title: 'Cities with the best tram networks' },
    });

    expect(response.status).toBe(201);
    expect(data).toEqual({
      id: expect.any(Number),
      title: 'Cities with the best tram networks',
      description: null,
      visibility: 'public',
      entryCount: 0,
      createdAt: expect.any(String),
    });
    expect(await myLists()).toEqual([data]);
  });

  it('makes a new list public (FR-LIST-005, BR-013)', async () => {
    expect((await createList()).visibility).toBe('public');
  });

  it('takes a description and a visibility', async () => {
    const { data } = await ada.POST('/v1/lists', {
      body: { title: 'Again', description: 'Cities I want to visit again', visibility: 'private' },
    });

    expect(data).toMatchObject({
      description: 'Cities I want to visit again',
      visibility: 'private',
    });
  });

  it('needs a title', async () => {
    const { response } = await ada.POST('/v1/lists', { body: { title: '  ' } });

    expect(response.status).toBe(400);
  });

  it('allows two lists with the same title and has no limit on their number', async () => {
    for (let count = 0; count < 25; count++) await createList('Trams');

    const { data } = await ada.GET('/v1/lists', { params: { query: { limit: 100 } } });
    expect(data?.items).toHaveLength(25);
  });

  it('needs a signed-in user (NFR-SEC-003)', async () => {
    const { response } = await clientFor(null).POST('/v1/lists', { body: { title: 'Trams' } });

    expect(response.status).toBe(401);
  });
});

describe('GET /v1/lists', () => {
  it('shows only the lists of the signed-in user, newest first, paginated', async () => {
    const first = await createList('First');
    const second = await createList('Second');
    await createList('Not mine', bob);

    const pageOne = await ada.GET('/v1/lists', { params: { query: { limit: 1 } } });
    const cursor = pageOne.data?.nextCursor ?? undefined;
    const pageTwo = await ada.GET('/v1/lists', { params: { query: { limit: 1, cursor } } });

    expect(pageOne.data?.items.map((list) => list.id)).toEqual([second.id]);
    expect(pageTwo.data?.items.map((list) => list.id)).toEqual([first.id]);
    expect(pageTwo.data?.nextCursor).toBeNull();
  });
});

describe('PATCH /v1/lists/{listId} (FR-LIST-003, FR-LIST-005)', () => {
  const change = (
    listId: number,
    body: { title?: string; description?: string | null; visibility?: 'public' | 'private' },
    client = ada,
  ) => client.PATCH('/v1/lists/{listId}', { params: { path: { listId } }, body });

  it('renames a list and leaves the rest as it is', async () => {
    const list = await createList();
    await change(list.id, { description: 'Trams!' });

    const { data } = await change(list.id, { title: 'Tram cities' });

    expect(data).toMatchObject({
      title: 'Tram cities',
      description: 'Trams!',
      visibility: 'public',
    });
  });

  it('makes a list private and public again', async () => {
    const list = await createList();

    const hidden = await change(list.id, { visibility: 'private' });
    const shown = await change(list.id, { visibility: 'public' });

    expect(hidden.data?.visibility).toBe('private');
    expect(shown.data?.visibility).toBe('public');
  });

  it('removes the description', async () => {
    const list = await createList();
    await change(list.id, { description: 'Trams!' });

    const { data } = await change(list.id, { description: null });

    expect(data?.description).toBeNull();
  });

  it('rejects an empty title', async () => {
    const list = await createList();

    const { response } = await change(list.id, { title: '' });

    expect(response.status).toBe(400);
  });

  it('answers 404 for the list of another user and leaves it as it is (NFR-SEC-003)', async () => {
    const list = await createList();

    const { response } = await change(list.id, { title: 'Mine now' }, bob);

    expect(response.status).toBe(404);
    expect((await myLists())?.[0]?.title).toBe(list.title);
  });
});

describe('DELETE /v1/lists/{listId} (FR-LIST-003)', () => {
  const remove = (listId: number, client = ada) =>
    client.DELETE('/v1/lists/{listId}', { params: { path: { listId } } });

  it('deletes the list with its entries', async () => {
    const list = await listOfThree();

    const { response } = await remove(list.id);

    expect(response.status).toBe(204);
    expect(await myLists()).toEqual([]);
    expect(await sql`SELECT 1 FROM list_entries`).toHaveLength(0);
  });

  it('answers 404 for the list of another user and keeps it (NFR-SEC-003)', async () => {
    const list = await createList();

    const { response } = await remove(list.id, bob);

    expect(response.status).toBe(404);
    expect(await myLists()).toHaveLength(1);
  });
});

describe('Lists are private to their owner for now (FR-LIST-005, NFR-SEC-003)', () => {
  it('answers 404 to another user for a list and its entries, public or not', async () => {
    const list = await listOfThree();
    const path = { params: { path: { listId: list.id } } };

    expect((await bob.GET('/v1/lists/{listId}', path)).response.status).toBe(404);
    expect((await bob.GET('/v1/lists/{listId}/entries', path)).response.status).toBe(404);
    expect((await ada.GET('/v1/lists/{listId}', path)).data?.entryCount).toBe(3);
  });
});

describe('POST /v1/lists/{listId}/entries (FR-LIST-004)', () => {
  it('adds cities to the end of the list, with an optional note', async () => {
    const list = await createList();

    const first = await addEntry(list.id, wuppertal, 'The Schwebebahn');
    await addEntry(list.id, aachen);

    expect(first.response.status).toBe(201);
    expect(await entries(list.id)).toEqual([
      { cityId: wuppertal, position: 1, note: 'The Schwebebahn' },
      { cityId: aachen, position: 2, note: null },
    ]);
  });

  it('adds any city, visited or not', async () => {
    const list = await createList();
    await ada.POST('/v1/visits', { body: { cityId: wuppertal, date: '2026-05-10' } });

    await addEntry(list.id, wuppertal);
    await addEntry(list.id, aachen);

    expect(await order(list.id)).toEqual([wuppertal, aachen]);
  });

  it('rejects a city that is already in the list', async () => {
    const list = await listOfThree();

    const { response } = await addEntry(list.id, aachen);

    expect(response.status).toBe(409);
    expect(await order(list.id)).toEqual([wuppertal, aachen, bonn]);
  });

  it('lets the same city be in two lists', async () => {
    const trams = await createList('Trams');
    const again = await createList('Again');

    await addEntry(trams.id, wuppertal);
    const { response } = await addEntry(again.id, wuppertal);

    expect(response.status).toBe(201);
  });

  it('answers 404 for a city that does not exist', async () => {
    const list = await createList();

    const { response } = await addEntry(list.id, 999);

    expect(response.status).toBe(404);
  });

  it('answers 404 for the list of another user and adds nothing (NFR-SEC-003)', async () => {
    const list = await createList();

    const { response } = await addEntry(list.id, wuppertal, undefined, bob);

    expect(response.status).toBe(404);
    expect(await entries(list.id)).toEqual([]);
  });

  it('keeps the order when cities are added at the same time', async () => {
    const list = await createList();

    await Promise.all([wuppertal, aachen, bonn, kassel].map((cityId) => addEntry(list.id, cityId)));

    expect(await positions(list.id)).toEqual([1, 2, 3, 4]);
  });
});

describe('PATCH /v1/lists/{listId}/entries/{cityId} (FR-LIST-004)', () => {
  it('moves the third of three cities to the top', async () => {
    const list = await listOfThree();

    const { data } = await changeEntry(list.id, bonn, { position: 1 });

    expect(data).toMatchObject({ cityId: bonn, position: 1 });
    expect(await order(list.id)).toEqual([bonn, wuppertal, aachen]);
    expect(await positions(list.id)).toEqual([1, 2, 3]);
  });

  it('moves a city down', async () => {
    const list = await listOfThree();
    await addEntry(list.id, kassel);

    await changeEntry(list.id, wuppertal, { position: 3 });

    expect(await order(list.id)).toEqual([aachen, bonn, wuppertal, kassel]);
    expect(await positions(list.id)).toEqual([1, 2, 3, 4]);
  });

  it('leaves the order alone when the city stays where it is', async () => {
    const list = await listOfThree();

    await changeEntry(list.id, aachen, { position: 2 });

    expect(await order(list.id)).toEqual([wuppertal, aachen, bonn]);
  });

  it('rejects a place past the end of the list', async () => {
    const list = await listOfThree();

    const { error, response } = await changeEntry(list.id, wuppertal, { position: 4 });

    expect(response.status).toBe(400);
    expect(error?.errors?.[0]?.path).toBe('position');
    expect(await order(list.id)).toEqual([wuppertal, aachen, bonn]);
  });

  it('changes and removes the note without moving the city', async () => {
    const list = await listOfThree();

    const noted = await changeEntry(list.id, aachen, { note: 'Printen' });
    const cleared = await changeEntry(list.id, aachen, { note: null });

    expect(noted.data).toEqual({ cityId: aachen, position: 2, note: 'Printen' });
    expect(cleared.data?.note).toBeNull();
    expect(await order(list.id)).toEqual([wuppertal, aachen, bonn]);
  });

  it('keeps the note when the city moves', async () => {
    const list = await createList();
    await addEntry(list.id, wuppertal);
    await addEntry(list.id, aachen, 'Printen');

    const { data } = await changeEntry(list.id, aachen, { position: 1 });

    expect(data).toEqual({ cityId: aachen, position: 1, note: 'Printen' });
  });

  it('answers 404 for a city that is not in the list', async () => {
    const list = await listOfThree();

    const { response } = await changeEntry(list.id, kassel, { position: 1 });

    expect(response.status).toBe(404);
  });

  it('answers 404 for the list of another user and changes nothing (NFR-SEC-003)', async () => {
    const list = await listOfThree();

    const { response } = await changeEntry(list.id, bonn, { position: 1 }, bob);

    expect(response.status).toBe(404);
    expect(await order(list.id)).toEqual([wuppertal, aachen, bonn]);
  });
});

describe('DELETE /v1/lists/{listId}/entries/{cityId} (FR-LIST-004)', () => {
  it('removes the city and closes the gap', async () => {
    const list = await listOfThree();

    const { response } = await removeEntry(list.id, aachen);

    expect(response.status).toBe(204);
    expect(await entries(list.id)).toEqual([
      { cityId: wuppertal, position: 1, note: null },
      { cityId: bonn, position: 2, note: null },
    ]);
  });

  it('answers 404 for a city that is not in the list', async () => {
    const list = await listOfThree();

    const { response } = await removeEntry(list.id, kassel);

    expect(response.status).toBe(404);
  });

  it('answers 404 for the list of another user and removes nothing (NFR-SEC-003)', async () => {
    const list = await listOfThree();

    const { response } = await removeEntry(list.id, aachen, bob);

    expect(response.status).toBe(404);
    expect(await order(list.id)).toEqual([wuppertal, aachen, bonn]);
  });
});

describe('GET /v1/lists/{listId}/entries', () => {
  it('is paginated in list order (SRS 6.2)', async () => {
    const list = await listOfThree();
    await changeEntry(list.id, bonn, { position: 1 });
    const page = (cursor?: string) =>
      ada.GET('/v1/lists/{listId}/entries', {
        params: { path: { listId: list.id }, query: { limit: 2, cursor } },
      });

    const first = await page();
    const second = await page(first.data?.nextCursor ?? undefined);

    expect(first.data?.items.map((entry) => entry.cityId)).toEqual([bonn, wuppertal]);
    expect(second.data?.items.map((entry) => entry.cityId)).toEqual([aachen]);
    expect(second.data?.nextCursor).toBeNull();
  });
});

describe('Account deletion', () => {
  it('removes the lists and their entries with the user (FR-AUTH-009)', async () => {
    await listOfThree();

    await sql`DELETE FROM users WHERE auth_provider_id = 'clerk_ada'`;

    expect(await sql`SELECT 1 FROM lists`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM list_entries`).toHaveLength(0);
  });
});
