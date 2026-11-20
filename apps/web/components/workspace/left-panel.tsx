'use client';

import type { MapCity, TripCalendar, UserMap, VisitedMapCity } from '@flanr/shared';
import { SignInButton } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { RatingValue } from '@/components/city/rating-value';
import { Button } from '@/components/ui/button';
import { CityList } from '@/components/workspace/city-list';
import { TripCalendarView } from '@/components/workspace/trip-calendar';
import { cn } from '@/lib/utils';

const tabs = ['visited', 'planned', 'calendar'] as const;
type Tab = (typeof tabs)[number];

interface LeftPanelProps {
  /** The signed-in user's cities and calendar; null for a guest. */
  data: UserMap | null;
  calendar: TripCalendar | null;
  onSelectCity: (city: MapCity) => void;
  className?: string;
}

/** The panel at the left of the map: the user's lists and trip calendar (FR-MAP-008). */
export function LeftPanel({ data, calendar, onSelectCity, className }: LeftPanelProps) {
  const t = useTranslations('workspace');
  const [tab, setTab] = useState<Tab>('visited');
  const cities = useMemo(
    () => new Map([...(data?.visited ?? []), ...(data?.planned ?? [])].map((c) => [c.cityId, c])),
    [data],
  );
  const names = useMemo(
    () => new Map([...cities.values()].map((city) => [city.cityId, city.name])),
    [cities],
  );

  return (
    <aside
      aria-label={t('leftPanel')}
      className={cn(
        'flex flex-col gap-3 overflow-hidden rounded-xl border bg-background p-3 shadow-md',
        className,
      )}
    >
      {!data ? (
        <div className="flex flex-col items-start gap-3 text-sm">
          <p>{t('guest')}</p>
          <SignInButton mode="redirect">
            <Button size="sm">{t('signIn')}</Button>
          </SignInButton>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label={t('leftPanel')} className="flex gap-1 border-b">
            {tabs.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  '-mb-px border-b-2 px-2 py-1.5 text-sm font-medium',
                  tab === key
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {key === 'calendar'
                  ? t('tabs.calendar')
                  : t(`tabs.${key}`, { count: data[key].length })}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {tab === 'visited' && (
              <CityList
                label={t('lists.visited')}
                cities={data.visited}
                empty={t('lists.noVisited')}
                details={(city) => <VisitedDetails city={city} />}
                onSelect={onSelectCity}
              />
            )}
            {tab === 'planned' && (
              <CityList
                label={t('lists.planned')}
                cities={data.planned}
                empty={t('lists.noPlanned')}
                onSelect={onSelectCity}
              />
            )}
            {tab === 'calendar' && calendar && (
              <TripCalendarView
                calendar={calendar}
                names={names}
                onSelectCity={(cityId) => {
                  const city = cities.get(cityId);
                  if (city) onSelectCity(city);
                }}
              />
            )}
          </div>
        </>
      )}
    </aside>
  );
}

/** Lived-in mark, visits and rating of a visited city in the list. */
function VisitedDetails({ city }: { city: VisitedMapCity }) {
  const t = useTranslations('workspace.lists');
  // A lived-in city counts above any number of visits (BR-016).
  const facts = [
    city.livedIn && t('livedIn'),
    city.visitCount > 0 && t('visits', { count: city.visitCount }),
  ].filter(Boolean);
  return (
    <>
      <span className="shrink-0 text-xs text-muted-foreground">{facts.join(' · ')}</span>
      {city.rating !== null && (
        <RatingValue value={city.rating} className="min-w-8 px-1 py-0 text-xs" />
      )}
    </>
  );
}
