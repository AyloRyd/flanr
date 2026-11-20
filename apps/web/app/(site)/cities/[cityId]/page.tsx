import { Map as MapIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CityFacts } from '@/components/city/city-facts';
import { CityHeader } from '@/components/city/city-header';
import { CityLinks } from '@/components/city/city-links';
import { CommunityRatingCard } from '@/components/city/community-rating-card';
import { OwnCityCard } from '@/components/city/own-city-card';
import { CityMap } from '@/components/map/city-map';
import { Button } from '@/components/ui/button';
import { loadCity, loadOwnData } from '@/lib/city-page';

interface CityPageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const loaded = await loadCity((await params).cityId);
  return loaded ? { title: loaded.city.name } : {};
}

/**
 * The full city page (FR-CITY-001…004, FR-CITY-009): the expanded city panel of the map with a
 * small map of the boundary (FR-MAP-004). Open to guests (FR-AUTH-001); a signed-in user also
 * sees their own data. The page that search engines index (NFR-SEO-003).
 */
export default async function CityPage({ params }: CityPageProps) {
  const loaded = await loadCity((await params).cityId);
  if (!loaded) notFound();
  const { city, rating } = loaded;
  const [t, own] = await Promise.all([getTranslations('workspace'), loadOwnData(city.id)]);

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <CityHeader
        city={city}
        own={own}
        extra={
          <Button variant="outline" asChild>
            <Link href={`/map/cities/${city.id}`}>
              <MapIcon aria-hidden />
              {t('showOnMap')}
            </Link>
          </Button>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <CityMap city={city} />
          <CityFacts city={city} />
          <CommunityRatingCard rating={rating} />
        </div>
        <div className="flex flex-col gap-6">
          {own && (
            <OwnCityCard
              cityName={city.name}
              data={own.data}
              criteria={rating.criteria.map(({ key, name }) => ({ key, name }))}
              visits={own.visits}
              registeredOn={own.registeredOn}
              username={own.username}
            />
          )}
          <CityLinks city={city} />
        </div>
      </div>
    </article>
  );
}
