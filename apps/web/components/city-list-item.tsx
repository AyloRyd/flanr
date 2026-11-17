import type { CitySummary } from '@flanr/shared';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { RatingValue } from '@/components/city/rating-value';

interface CityListItemProps {
  city: CitySummary;
  /** The name a search matched, if it is neither the local nor the English name. */
  matchedName?: string | null;
  /** Shown on the right instead of the community rating, such as the user's own rating. */
  aside?: ReactNode;
  /** Shown below the place, such as a note or the controls of a list entry. */
  children?: ReactNode;
}

/**
 * A city in a list of cities, with what tells cities of the same name apart: settlement type,
 * municipality, region and country (FR-SRCH-002).
 */
export function CityListItem({ city, matchedName = null, aside, children }: CityListItemProps) {
  const t = useTranslations('search');
  const tCity = useTranslations('city');
  const format = useFormatter();
  const place = [
    city.municipality && tCity('partOf', { municipality: city.municipality }),
    city.region,
    city.country.name,
  ].filter(Boolean);

  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <Link
          href={`/cities/${city.id}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {city.name}
        </Link>
        {city.nameEn !== city.name && (
          <span className="text-muted-foreground" lang="en">
            {' '}
            · {city.nameEn}
          </span>
        )}
        {matchedName && (
          <span className="text-sm text-muted-foreground">
            {' '}
            ({t('alsoKnownAs', { name: matchedName })})
          </span>
        )}
        <p className="text-sm text-muted-foreground">
          {tCity(`settlementType.${city.settlementType}`)} · {place.join(', ')}
          {city.population !== null &&
            ` · ${t('population', { population: format.number(city.population) })}`}
        </p>
        {children}
      </div>
      {aside !== undefined
        ? aside
        : city.rating !== null && (
            <div className="flex shrink-0 flex-col items-end gap-1">
              <RatingValue value={city.rating} />
              <span className="text-xs text-muted-foreground">
                {tCity('ratingCount', { count: city.ratingCount })}
              </span>
            </div>
          )}
    </li>
  );
}
