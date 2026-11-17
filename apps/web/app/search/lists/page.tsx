import type { Metadata } from 'next';
import Form from 'next/form';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SearchField } from '@/components/search/search-field';
import { SearchTabs } from '@/components/search/search-tabs';
import { serverApi } from '@/lib/api';
import { profilePath } from '@/lib/profile';
import { toListSearchQuery, withCursor, type SearchParams } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('search');
  return { title: t('listsTitle') };
}

/**
 * Search the public custom lists by title and description, also those of private profiles
 * (FR-SRCH-004, FR-LIST-006).
 */
export default async function ListSearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const t = await getTranslations('search');
  const query = toListSearchQuery(params);
  const q = typeof params.q === 'string' ? params.q : '';
  const { data } = query ? await serverApi().GET('/v1/public-lists', { params: { query } }) : {};

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <SearchTabs current="lists" q={q} />
      <Form action="/search/lists">
        <SearchField defaultValue={q} label={t('listLabel')} />
      </Form>

      {!query && <p className="text-muted-foreground">{t('listHint')}</p>}
      {query && !data && (
        <p role="alert" className="text-destructive">
          {t('problem.invalid')}
        </p>
      )}
      {data && (
        <div aria-live="polite">
          {data.items.length === 0 ? (
            <p className="text-muted-foreground">{t('noLists')}</p>
          ) : (
            <ul aria-label={t('results')} className="divide-y">
              {data.items.map((list) => (
                <li key={list.id} className="py-3">
                  <Link
                    href={profilePath(list.owner.username, `/lists/${list.id}`)}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {list.title}
                  </Link>
                  {list.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{list.description}</p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('listBy', {
                      name: list.owner.displayName,
                      username: list.owner.username,
                      count: list.entryCount,
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {data.nextCursor && (
            <Link
              href={withCursor('/search/lists', params, data.nextCursor)}
              className="mt-4 inline-block font-medium underline-offset-4 hover:underline"
            >
              {t('more')}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
