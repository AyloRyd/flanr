import type { CityDetails, CommunityRating } from '@flanr/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { CityFacts } from '@/components/city/city-facts';
import { CityLinks } from '@/components/city/city-links';
import { CommunityRatingCard } from '@/components/city/community-rating-card';
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

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const loaded = await loadCity((await params).cityId);
  return loaded ? { title: loaded.city.name } : {};
}

/** The city page (FR-CITY-001…003, FR-CITY-009). Open to guests (FR-AUTH-001). */
export default async function CityPage({ params }: CityPageProps) {
  const loaded = await loadCity((await params).cityId);
  if (!loaded) notFound();
  const { city, rating } = loaded;
  const t = await getTranslations('city');

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
        <p className="text-sm font-medium text-muted-foreground">
          {t(`settlementType.${city.settlementType}`)} · {place}
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{city.name}</h1>
        {city.nameEn !== city.name && (
          <p className="text-xl text-muted-foreground" lang="en">
            {city.nameEn}
          </p>
        )}
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
          <CityLinks city={city} />
        </div>
      </div>
    </article>
  );
}
