import { auth } from '@clerk/nextjs/server';
import type { CityDetails, CommunityRating, OwnCityData, Visit } from '@flanr/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { CityFacts } from '@/components/city/city-facts';
import { CityLinks } from '@/components/city/city-links';
import { CommunityRatingCard } from '@/components/city/community-rating-card';
import { LogVisitButton } from '@/components/city/log-visit-button';
import { OwnCityCard } from '@/components/city/own-city-card';
import { PlanButton } from '@/components/city/plan-button';
import { serverApi } from '@/lib/api';

interface CityPageProps {
  params: Promise<{ cityId: string }>;
}

/** The city and its community rating, or null if there is no such city. Read once per request. */
const loadCity = cache(
  async (rawId: string): Promise<{ city: CityDetails; rating: CommunityRating } | null> => {
    // Only digits: anything else cannot be a city ID, and the API would answer 400.
    if (!/^[1-9]\d{0,8}$/.test(rawId)) return null;
    const cityId = Number(rawId);
    const api = serverApi();
    const path = { params: { path: { cityId } } };
    const [city, rating] = await Promise.all([
      api.GET('/v1/cities/{cityId}', path),
      api.GET('/v1/cities/{cityId}/community-rating', path),
    ]);
    if (city.response.status === 404) return null;
    if (!city.data || !rating.data) {
      throw new Error(`City ${cityId} could not be loaded: ${city.response.status}`);
    }
    return { city: city.data, rating: rating.data };
  },
);

/** How many dated visits the city page lists; the rest are counted. */
const shownVisits = 10;

interface OwnData {
  data: OwnCityData;
  visits: Visit[];
  /** The day the user registered, as YYYY-MM-DD. Visits after it need a date (BR-002). */
  registeredOn: string;
}

/** The signed-in user's own data for the city and their newest visits; null for a guest. */
async function loadOwnData(cityId: number): Promise<OwnData | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const api = serverApi();
  const [own, visits, me] = await Promise.all([
    api.GET('/v1/me/cities/{cityId}', { params: { path: { cityId } } }),
    api.GET('/v1/visits', { params: { query: { cityId, limit: shownVisits } } }),
    api.GET('/v1/me'),
  ]);
  if (!own.data || !visits.data || !me.data) {
    throw new Error(`Own data for city ${cityId} could not be loaded: ${own.response.status}`);
  }
  // The API takes the date of the registration in UTC as well.
  const registeredOn = me.data.registeredAt.slice(0, 10);
  return { data: own.data, visits: visits.data.items, registeredOn };
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const loaded = await loadCity((await params).cityId);
  return loaded ? { title: loaded.city.name } : {};
}

/**
 * The city page (FR-CITY-001…004, FR-CITY-009). Open to guests (FR-AUTH-001); a signed-in user
 * also sees their own data.
 */
export default async function CityPage({ params }: CityPageProps) {
  const loaded = await loadCity((await params).cityId);
  if (!loaded) notFound();
  const { city, rating } = loaded;
  const [t, own] = await Promise.all([getTranslations('city'), loadOwnData(city.id)]);

  const place = [city.region?.name, city.country.name].filter(Boolean).join(', ');
  const capital =
    city.capitalStatus === 'national'
      ? t('capital.national', { country: city.country.name })
      : city.capitalStatus === 'regional' && city.region
        ? t('capital.regional', { region: city.region.name })
        : null;

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              {t(`settlementType.${city.settlementType}`)} · {place}
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{city.name}</h1>
            {city.nameEn !== city.name && (
              <p className="text-xl text-muted-foreground" lang="en">
                {city.nameEn}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <LogVisitButton
              cityId={city.id}
              cityName={city.name}
              registeredOn={own?.registeredOn ?? null}
            />
            {/* A visited city is in the Visited list and cannot be planned (FR-LIST-002, BR-004). */}
            {!own?.data.visited && (
              <PlanButton
                cityId={city.id}
                signedIn={own !== null}
                planned={own?.data.planned ?? false}
              />
            )}
          </div>
        </div>
        {(city.municipality || capital) && (
          <ul className="mt-1 flex flex-wrap gap-2 text-sm">
            {city.municipality && (
              <li className="rounded-full bg-secondary px-3 py-1">
                {t('partOf', { municipality: city.municipality.name })}
              </li>
            )}
            {capital && <li className="rounded-full bg-secondary px-3 py-1">{capital}</li>}
          </ul>
        )}
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <CityFacts city={city} />
          <CommunityRatingCard rating={rating} />
        </div>
        <div className="flex flex-col gap-6">
          {own && <OwnCityCard data={own.data} visits={own.visits} />}
          <CityLinks city={city} />
        </div>
      </div>
    </article>
  );
}
