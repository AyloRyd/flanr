import type { List, ListEntry } from '@flanr/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { ListEntries } from '@/components/lists/list-entries';
import { ListOwnerActions } from '@/components/lists/list-owner-actions';
import { MoreLink } from '@/components/profile/more-link';
import { serverApi } from '@/lib/api';
import { loadCitySummaries } from '@/lib/city-summaries';
import { loadProfile, profilePath, type ProfileView } from '@/lib/profile';
import type { SearchParams } from '@/lib/search-params';

interface ListPageProps {
  params: Promise<{ username: string; listId: string }>;
  searchParams: Promise<SearchParams>;
}

/** Entries per page; a list is reordered within what is shown. */
const entriesPerPage = 100;

/**
 * The list with its profile, or null if there is no such list for this visitor. The owner
 * reads their own, private ones too; anyone else only a public list (FR-LIST-005).
 */
const loadList = cache(
  async (username: string, rawId: string): Promise<{ view: ProfileView; list: List } | null> => {
    if (!/^[1-9]\d{0,8}$/.test(rawId)) return null;
    const listId = Number(rawId);
    const view = await loadProfile(username);
    if (!view) return null;
    const api = serverApi();
    const { data } = view.isOwner
      ? await api.GET('/v1/lists/{listId}', { params: { path: { listId } } })
      : await api.GET('/v1/users/{username}/lists/{listId}', {
          params: { path: { username: view.profile.username, listId } },
        });
    return data ? { view, list: data } : null;
  },
);

export async function generateMetadata({ params }: ListPageProps): Promise<Metadata> {
  const { username, listId } = await params;
  const loaded = await loadList(username, listId);
  return loaded ? { title: loaded.list.title } : {};
}

/** A custom list with its cities in order (FR-LIST-004); its owner can change it. */
export default async function ListPage({ params, searchParams }: ListPageProps) {
  const { username, listId } = await params;
  const loaded = await loadList(username, listId);
  if (!loaded) notFound();
  const { view, list } = loaded;
  const { profile, isOwner } = view;
  const t = await getTranslations('lists');

  const cursor = (await searchParams).cursor;
  const query = {
    limit: entriesPerPage,
    ...(typeof cursor === 'string' && cursor ? { cursor } : {}),
  };
  const api = serverApi();
  const page = isOwner
    ? await api.GET('/v1/lists/{listId}/entries', { params: { path: { listId: list.id }, query } })
    : await api.GET('/v1/users/{username}/lists/{listId}/entries', {
        params: { path: { username: profile.username, listId: list.id }, query },
      });
  if (!page.data) throw new Error(`List entries could not be loaded: ${page.response.status}`);
  const entries: ListEntry[] = page.data.items;
  const cities = await loadCitySummaries(entries.map((entry) => entry.cityId));
  const listsPath = profilePath(profile.username, '/lists');

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-2">
        <Link
          href={listsPath}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t('backTo', { name: profile.displayName })}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{list.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t('by', { name: profile.displayName, username: profile.username })} ·{' '}
          {t('cityCount', { count: list.entryCount })}
          {isOwner && ` · ${list.visibility === 'private' ? t('privateBadge') : t('publicBadge')}`}
        </p>
        {list.description && <p className="max-w-2xl whitespace-pre-line">{list.description}</p>}
        {isOwner && <ListOwnerActions list={list} listsPath={listsPath} />}
      </header>

      {entries.length === 0 ? (
        <p className="text-muted-foreground">{isOwner ? t('emptyOwn') : t('empty')}</p>
      ) : (
        <ListEntries
          listId={list.id}
          entryCount={list.entryCount}
          isOwner={isOwner}
          entries={entries.flatMap((entry) => {
            const city = cities.get(entry.cityId);
            return city ? [{ entry, city }] : [];
          })}
        />
      )}
      <MoreLink path={`${listsPath}/${list.id}`} cursor={page.data.nextCursor} />
    </article>
  );
}
