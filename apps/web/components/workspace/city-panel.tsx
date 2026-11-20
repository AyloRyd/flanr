import type { CityDetails, CommunityRating } from '@flanr/shared';
import { Maximize2, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CityFacts } from '@/components/city/city-facts';
import { CityHeader } from '@/components/city/city-header';
import { CityLinks } from '@/components/city/city-links';
import { CommunityRatingCard } from '@/components/city/community-rating-card';
import { OwnCityCard } from '@/components/city/own-city-card';
import { Button } from '@/components/ui/button';
import { MapSelection } from '@/components/workspace/map-selection';
import type { OwnData } from '@/lib/city-page';
import { cityShape } from '@/lib/map/layers';

interface CityPanelProps {
  city: CityDetails;
  rating: CommunityRating;
  own: OwnData | null;
}

/**
 * The city panel at the side of the map (FR-MAP-004): what the city page shows, with the
 * actions, and a way to expand it to the full city page. It opens from the bottom on phones.
 */
export function CityPanel({ city, rating, own }: CityPanelProps) {
  const t = useTranslations('workspace.panel');
  const view = cityShape(city).view;

  return (
    <aside
      aria-label={t('label', { city: city.name })}
      className="absolute inset-x-0 bottom-0 z-30 max-h-[65svh] overflow-y-auto rounded-t-xl border bg-background shadow-lg sm:inset-x-auto sm:top-3 sm:right-3 sm:bottom-3 sm:max-h-none sm:w-[26rem] sm:rounded-xl"
    >
      <MapSelection
        city={{
          id: city.id,
          position: [city.centre.longitude, city.centre.latitude],
          settlementType: city.settlementType,
          bounds: 'bounds' in view ? view.bounds : null,
        }}
      />
      <div className="sticky top-0 z-10 flex justify-end gap-1 bg-background/95 p-2 backdrop-blur">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/cities/${city.id}`} aria-label={t('expand')} title={t('expand')}>
            <Maximize2 />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <Link href="/map" aria-label={t('close')} title={t('close')}>
            <X />
          </Link>
        </Button>
      </div>
      <div className="flex flex-col gap-5 px-5 pb-5">
        <CityHeader city={city} own={own} compact />
        <CommunityRatingCard rating={rating} />
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
        <CityFacts city={city} />
        <CityLinks city={city} />
      </div>
    </aside>
  );
}
