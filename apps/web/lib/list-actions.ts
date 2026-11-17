'use server';

import type { CreateList, List, Visibility } from '@flanr/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { serverApi } from '@/lib/api';
import { loadAllPages } from '@/lib/city-summaries';

/** What can change about a list; only the given fields change. */
export interface ListChange {
  title?: string;
  description?: string | null;
  visibility?: Visibility;
}

/** What can change about an entry: its note, its place, or both. */
export interface EntryChange {
  note?: string | null;
  position?: number;
}

export type ListResult = { ok: true } | { ok: false; problem: 'failed' };

/** A change to a list shows on the list, the owner's profile and the city pages. */
function refresh(): void {
  revalidatePath('/', 'layout');
}

/** Creates a custom list of the signed-in user (FR-LIST-003). Public unless chosen otherwise. */
export async function createList(
  list: CreateList,
): Promise<{ ok: true; list: List } | { ok: false; problem: 'failed' }> {
  const { data } = await serverApi().POST('/v1/lists', { body: list });
  if (!data) return { ok: false, problem: 'failed' };
  refresh();
  return { ok: true, list: data };
}

/** Creates a list and opens it; the redirect happens on the server, after the list exists. */
export async function createListAndOpen(
  list: CreateList,
  listsPath: string,
): Promise<{ ok: false; problem: 'failed' }> {
  const result = await createList(list);
  if (!result.ok) return result;
  redirect(`${listsPath}/${result.list.id}`);
}

/** Renames a list or changes its description or visibility (FR-LIST-003, FR-LIST-005). */
export async function updateList(listId: number, change: ListChange): Promise<ListResult> {
  const { response } = await serverApi().PATCH('/v1/lists/{listId}', {
    params: { path: { listId } },
    body: change,
  });
  if (!response.ok) return { ok: false, problem: 'failed' };
  refresh();
  return { ok: true };
}

/** Deletes a list with its entries (FR-LIST-003). */
export async function deleteList(listId: number): Promise<ListResult> {
  const { response } = await serverApi().DELETE('/v1/lists/{listId}', {
    params: { path: { listId } },
  });
  if (!response.ok && response.status !== 404) return { ok: false, problem: 'failed' };
  refresh();
  return { ok: true };
}

/** Adds a city to the end of a list (FR-LIST-004). A city is in a list at most once. */
export async function addToList(
  listId: number,
  cityId: number,
): Promise<{ ok: true } | { ok: false; problem: 'already_in_list' | 'failed' }> {
  const { response } = await serverApi().POST('/v1/lists/{listId}/entries', {
    params: { path: { listId } },
    body: { cityId },
  });
  if (response.status === 409) return { ok: false, problem: 'already_in_list' };
  if (!response.ok) return { ok: false, problem: 'failed' };
  refresh();
  return { ok: true };
}

/** Removes a city from a list (FR-LIST-004). */
export async function removeFromList(listId: number, cityId: number): Promise<ListResult> {
  const { response } = await serverApi().DELETE('/v1/lists/{listId}/entries/{cityId}', {
    params: { path: { listId, cityId } },
  });
  if (!response.ok && response.status !== 404) return { ok: false, problem: 'failed' };
  refresh();
  return { ok: true };
}

/** Changes the note of an entry or moves it to another place (FR-LIST-004). */
export async function updateEntry(
  listId: number,
  cityId: number,
  change: EntryChange,
): Promise<ListResult> {
  const { response } = await serverApi().PATCH('/v1/lists/{listId}/entries/{cityId}', {
    params: { path: { listId, cityId } },
    body: change,
  });
  if (!response.ok) return { ok: false, problem: 'failed' };
  refresh();
  return { ok: true };
}

/** All custom lists of the signed-in user, for adding a city to them. */
export async function loadMyLists(): Promise<List[]> {
  const api = serverApi();
  return loadAllPages(async (cursor) => {
    const { data, response } = await api.GET('/v1/lists', {
      params: { query: { limit: 100, ...(cursor ? { cursor } : {}) } },
    });
    if (!data) throw new Error(`Lists could not be loaded: ${response.status}`);
    return data;
  });
}
