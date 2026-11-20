import type { CityDetails } from '@flanr/shared';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { LogVisitButton } from '@/components/city/log-visit-button';
import { PlanButton } from '@/components/city/plan-button';
import type { OwnData } from '@/lib/city-page';
import { cn } from '@/lib/utils';

interface CityHeaderProps {
  city: CityDetails;
  own: OwnData | null;
  /** Smaller, for the city panel next to the map. */
  compact?: boolean;
  /** Further links next to the actions, such as back to the map. */
  extra?: ReactNode;
}

/**
 * The name and place of a city with the actions to log a visit and to plan it, on the city page
 * and in the city panel of the map (FR-CITY-001, FR-MAP-004).
 */
export function CityHeader({ city, own, compact = false, extra }: CityHeaderProps) {
  const t = useTranslations('city');
  const place = [city.region?.name, city.country.name].filter(Boolean).join(', ');
  const capital =
    city.capitalStatus === 'national'
      ? t('capital.national', { country: city.country.name })
      : city.capitalStatus === 'regional' && city.region
        ? t('capital.regional', { region: city.region.name })
        : null;

  return (
    <header className="flex flex-col gap-2">
      <div
        className={cn(
          'flex flex-col gap-4',
          !compact && 'sm:flex-row sm:items-start sm:justify-between',
        )}
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            {t(`settlementType.${city.settlementType}`)} · {place}
          </p>
          <h1
            className={cn(
              'font-bold tracking-tight',
              compact ? 'text-3xl' : 'text-4xl sm:text-5xl',
            )}
          >
            {city.name}
          </h1>
          {city.nameEn !== city.name && (
            <p className={cn('text-muted-foreground', compact ? 'text-lg' : 'text-xl')} lang="en">
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
          {extra}
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
  );
}
