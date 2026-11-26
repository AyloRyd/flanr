'use client';

import type { MapCity } from '@flanr/shared';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';

interface CityListProps<City extends MapCity> {
  /** The accessible name of the list. */
  label: string;
  cities: City[];
  /** What the list says without cities. */
  empty: string;
  /** Further information on a city's line, such as its visits. */
  details?: (city: City) => ReactNode;
  onSelect: (city: City) => void;
}

/**
 * The cities of one of the user's lists next to the map, sorted by name, with a filter
 * (FR-MAP-008). Choosing a city moves the map to it and opens its panel.
 */
export function CityList<City extends MapCity>({
  label,
  cities,
  empty,
  details,
  onSelect,
}: CityListProps<City>) {
  const t = useTranslations('workspace');
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const words = filter.trim().toLocaleLowerCase();
    return cities
      .filter((city) => city.name.toLocaleLowerCase().includes(words))
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }, [cities, filter]);

  if (cities.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <Input
        type="search"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder={t('filter')}
        aria-label={t('filterOf', { list: label })}
      />
      <ul aria-label={label} className="flex flex-col overflow-y-auto">
        {shown.map((city) => (
          <li key={city.cityId}>
            <button
              type="button"
              onClick={() => onSelect(city)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted"
            >
              <span className="min-w-0 flex-1 truncate">
                {city.name}
                <span className="ml-1.5 text-xs text-muted-foreground">{city.countryCode}</span>
              </span>
              {details?.(city)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
