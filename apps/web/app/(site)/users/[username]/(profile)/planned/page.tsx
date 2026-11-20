import { getTranslations } from 'next-intl/server';
import { CityListItem } from '@/components/city-list-item';
import { MoreLink } from '@/components/profile/more-link';
import { serverApi } from '@/lib/api';
import { loadCitySummaries } from '@/lib/city-summaries';
import { loadProfile, profilePath } from '@/lib/profile';
import { cursorOf, profilePageSize } from '@/lib/profile-lists';
import type { SearchParams } from '@/lib/search-params';

interface PlannedPageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<SearchParams>;
}

/** The Planned list of a profile (FR-PROF-004, FR-LIST-002); hidden on a private one (FR-PRIV-001). */
export default async function PlannedPage({ params, searchParams }: PlannedPageProps) {
  const { username } = await params;
  const view = await loadProfile(username);
  if (!view) return null;
  const { profile, isOwner } = view;
  const t = await getTranslations('profile');
  // The header already says that the profile is private (FR-PRIV-001).
  if (profile.isPrivate && !isOwner) return null;

  const query = { limit: profilePageSize, ...cursorOf(await searchParams) };
  const api = serverApi();
  const page = isOwner
    ? await api.GET('/v1/planned-cities', { params: { query } })
    : await api.GET('/v1/users/{username}/planned-cities', {
        params: { path: { username: profile.username }, query },
      });
  if (!page.data) throw new Error(`The Planned list could not be loaded: ${page.response.status}`);
  const items = page.data.items;
  if (items.length === 0) {
    return <p className="text-muted-foreground">{isOwner ? t('noPlannedOwn') : t('noPlanned')}</p>;
  }
  const cities = await loadCitySummaries(items.map((item) => item.cityId));

  return (
    <div>
      <ul aria-label={t('planned')} className="divide-y">
        {items.map((item) => {
          const city = cities.get(item.cityId);
          return city ? <CityListItem key={item.cityId} city={city} /> : null;
        })}
      </ul>
      <MoreLink path={profilePath(profile.username, '/planned')} cursor={page.data.nextCursor} />
    </div>
  );
}
