'use client';

import type { CitySummary } from '@flanr/shared';
import { X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { RatingValue } from '@/components/city/rating-value';
import { Button } from '@/components/ui/button';
import type { OwnMapData } from '@/lib/map/layers';

interface CityPreviewProps {
  /** Undefined while it loads, null if there is no such city. */
  city: CitySummary | null | undefined;
  cityId: number;
  own: OwnMapData;
  /** Whose data the map shows: null on the user's own map, else the profile's display name. */
  ownerName: string | null;
  onClose: () => void;
}

/**
 * The short preview of a city selected on the map: name, country, community rating, the data of
 * the map's owner and a link to the city page (FR-MAP-004).
 */
export function CityPreview({ city, cityId, own, ownerName, onClose }: CityPreviewProps) {
  const t = useTranslations('map.preview');
  const cityT = useTranslations('city');

  return (
    <section
      aria-label={t('label')}
      aria-busy={city === undefined}
      className="relative rounded-2xl border bg-background p-4 shadow-sm"
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2"
        aria-label={t('close')}
        onClick={onClose}
      >
        <X />
      </Button>
      {city === undefined && <p className="text-sm text-muted-foreground">{t('loading')}</p>}
      {city === null && <p className="text-sm text-muted-foreground">{t('notFound')}</p>}
      {city && (
        <div className="flex flex-col gap-3 pr-8">
          <div>
            <h2 className="text-lg leading-tight font-semibold">{city.name}</h2>
            <p className="text-sm text-muted-foreground">
              {[city.region, city.country.name].filter(Boolean).join(', ')}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {city.rating !== null ? (
              <>
                <RatingValue value={city.rating} />
                <span className="text-muted-foreground">
                  {cityT('ratingCount', { count: city.ratingCount })}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">{t('noRatings')}</span>
            )}
          </div>
          <OwnData own={own} ownerName={ownerName} />
        </div>
      )}
      <Link
        href={`/cities/${cityId}`}
        className="mt-3 inline-block text-sm font-medium underline underline-offset-4"
      >
        {t('open')}
      </Link>
    </section>
  );
}

function OwnData({ own, ownerName }: { own: OwnMapData; ownerName: string | null }) {
  const t = useTranslations('map.preview');
  const heading = ownerName === null ? t('yours') : t('theirs', { name: ownerName });

  const facts =
    own.kind === 'visited'
      ? [
          // A lived-in city counts above any number of visits (BR-016).
          own.livedIn && t('livedIn'),
          own.visitCount > 0 && t('visits', { count: own.visitCount }),
        ].filter((fact): fact is string => Boolean(fact))
      : [own.kind === 'planned' ? t('planned') : t('notVisited')];

  return (
    <div className="text-sm">
      <h3 className="text-muted-foreground">{heading}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span>{facts.join(' · ')}</span>
        {own.kind === 'visited' && own.rating !== null && (
          <span className="flex items-center gap-1">
            <span className="sr-only">{t('rating')}</span>
            <RatingValue value={own.rating} className="min-w-9 px-1.5 py-0.5" />
          </span>
        )}
      </div>
    </div>
  );
}
