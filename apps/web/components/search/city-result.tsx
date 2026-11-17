import type { CitySearchResult } from '@flanr/shared';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { RatingValue } from '@/components/city/rating-value';

/**
 * One city in the search results, with what tells cities of the same name apart: settlement
 * type, municipality, region and country (FR-SRCH-002).
 */
export function CityResult({ city }: { city: CitySearchResult }) {
  const t = useTranslations('search');
  const tCity = useTranslations('city');
  const format = useFormatter();
  const place = [
    city.municipality && tCity('partOf', { municipality: city.municipality }),
    city.region,
    city.country.name,
  ].filter(Boolean);

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
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
        {city.matchedName && (
          <span className="text-sm text-muted-foreground">
            {' '}
            ({t('alsoKnownAs', { name: city.matchedName })})
          </span>
        )}
        <p className="text-sm text-muted-foreground">
          {tCity(`settlementType.${city.settlementType}`)} · {place.join(', ')}
          {city.population !== null &&
            ` · ${t('population', { population: format.number(city.population) })}`}
        </p>
      </div>
      {city.rating !== null && (
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
