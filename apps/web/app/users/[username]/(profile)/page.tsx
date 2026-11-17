import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { CityListItem } from '@/components/city-list-item';
import { RatingValue } from '@/components/city/rating-value';
import { MoreLink } from '@/components/profile/more-link';
import { PublicLists } from '@/components/profile/public-lists';
import { serverApi } from '@/lib/api';
import { loadCitySummaries } from '@/lib/city-summaries';
import { loadProfile, profilePath } from '@/lib/profile';
import { cursorOf, loadRatingsByCity, profilePageSize } from '@/lib/profile-lists';
import type { SearchParams } from '@/lib/search-params';

interface VisitedPageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<SearchParams>;
}

/**
 * The Visited list of a profile with the user's ratings (FR-PROF-004, FR-LIST-001). Of a private
 * profile, others see the public custom lists instead (FR-PRIV-001).
 */
export default async function VisitedPage({ params, searchParams }: VisitedPageProps) {
  const { username } = await params;
  const view = await loadProfile(username);
  if (!view) return null;
  const { profile, isOwner } = view;
  if (profile.isPrivate && !isOwner) return <PublicLists username={profile.username} />;

  const t = await getTranslations('profile');
  const query = { limit: profilePageSize, ...cursorOf(await searchParams) };
  const api = serverApi();
  const [page, ratings] = await Promise.all([
    isOwner
      ? api.GET('/v1/visited-cities', { params: { query } })
      : api.GET('/v1/users/{username}/visited-cities', {
          params: { path: { username: profile.username }, query },
        }),
    loadRatingsByCity(profile.username, isOwner),
  ]);
  if (!page.data) throw new Error(`The Visited list could not be loaded: ${page.response.status}`);
  // The owner's list has the number of visits and the lived-in mark; others' only the cities.
  const items: { cityId: number; visitCount?: number; livedIn?: boolean }[] = page.data.items;
  const cities = await loadCitySummaries(items.map((item) => item.cityId));

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground">
        {isOwner
          ? t.rich('noVisitedOwn', {
              search: (chunks) => (
                <Link href="/search" className="underline underline-offset-4">
                  {chunks}
                </Link>
              ),
              onboarding: (chunks) => (
                <Link href="/onboarding" className="underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })
          : t('noVisited')}
      </p>
    );
  }

  return (
    <div>
      <ul aria-label={t('visited')} className="divide-y">
        {items.map((item) => {
          const city = cities.get(item.cityId);
          if (!city) return null;
          const rating = ratings.get(item.cityId);
          // Only the owner sees the number of visits and the lived-in mark (FR-PROF-003).
          const own =
            item.visitCount === undefined
              ? []
              : [
                  item.livedIn && t('livedIn'),
                  item.visitCount > 0 && t('visitCount', { count: item.visitCount }),
                ].filter(Boolean);
          return (
            <CityListItem
              key={item.cityId}
              city={city}
              aside={
                rating ? (
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="sr-only">{t('ratingOf', { name: profile.displayName })}</span>
                    <RatingValue value={rating.subjective} />
                  </span>
                ) : null
              }
            >
              {own.length > 0 && <p className="text-sm text-muted-foreground">{own.join(' · ')}</p>}
            </CityListItem>
          );
        })}
      </ul>
      <MoreLink path={profilePath(profile.username)} cursor={page.data.nextCursor} />
    </div>
  );
}
