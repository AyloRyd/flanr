import type { CitySearchResult, Country, Region } from '@flanr/shared';
import type { Metadata } from 'next';
import Form from 'next/form';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CityFilters } from '@/components/search/city-filters';
import { CityResult } from '@/components/search/city-result';
import { SearchField } from '@/components/search/search-field';
import { SearchTabs } from '@/components/search/search-tabs';
import { serverApi } from '@/lib/api';
import {
  hasCityFilters,
  readCitySearchFields,
  toCitySearchQuery,
  withCursor,
  type SearchParams,
} from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('search');
  return { title: t('title') };
}

/** The countries for the filter, and the regions of the chosen one. */
async function loadFilterOptions(
  country: string,
): Promise<{ countries: Country[]; regions: Region[] }> {
  const api = serverApi();
  const code = country.toUpperCase();
  const [countries, regions] = await Promise.all([
    api.GET('/v1/countries'),
    /^[A-Z]{2}$/.test(code)
      ? api.GET('/v1/countries/{code}/regions', { params: { path: { code } } })
      : null,
  ]);
  if (!countries.data)
    throw new Error(`Countries could not be loaded: ${countries.response.status}`);
  return { countries: countries.data.items, regions: regions?.data?.items ?? [] };
}

/**
 * Search and browse cities by name, with filters and sorting (FR-SRCH-001…003). The form is a
 * plain GET form, so every search has its own URL and works without JavaScript.
 */
export default async function CitySearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const t = await getTranslations('search');
  const fields = readCitySearchFields(params);
  const { countries, regions } = await loadFilterOptions(fields.country);
  // A region of another country, left over from changing the country, is dropped.
  if (!regions.some((region) => String(region.id) === fields.regionId)) fields.regionId = '';

  const request = toCitySearchQuery(fields);
  let results: { items: CitySearchResult[]; nextCursor: string | null } | null = null;
  let problem = 'problem' in request ? request.problem : null;
  if ('query' in request) {
    const { data } = await serverApi().GET('/v1/cities', { params: { query: request.query } });
    if (data) results = data;
    else problem = 'invalid';
  }

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <SearchTabs current="cities" q={fields.q} />
      <Form action="/search" className="flex flex-col gap-4">
        <SearchField defaultValue={fields.q} label={t('cityLabel')} />
        <CityFilters
          fields={fields}
          countries={countries}
          regions={regions}
          open={hasCityFilters(fields)}
        />
      </Form>

      {problem && (
        <p role="alert" className="text-destructive">
          {t(`problem.${problem}`)}
        </p>
      )}
      {results && (
        <div aria-live="polite">
          {results.items.length === 0 ? (
            <p className="text-muted-foreground">{t('noCities')}</p>
          ) : (
            <ul aria-label={t('results')} className="divide-y">
              {results.items.map((city) => (
                <CityResult key={city.id} city={city} />
              ))}
            </ul>
          )}
          {results.nextCursor && (
            <Link
              href={withCursor('/search', params, results.nextCursor)}
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
