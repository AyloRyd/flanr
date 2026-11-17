import type { Criterion, OwnCityData, Visit } from '@flanr/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { OwnVisits } from '@/components/city/own-visits';
import { RateButton } from '@/components/city/rate-button';
import { RatingValue } from '@/components/city/rating-value';
import { formatVisitDateForDisplay } from '@/lib/visit-date';

interface OwnCityCardProps {
  cityName: string;
  data: OwnCityData;
  /** The criteria the city can be rated by, in display order (FR-RATE-002). */
  criteria: Criterion[];
  /** The newest visits. */
  visits: Visit[];
  /** The day the user registered, as YYYY-MM-DD. */
  registeredOn: string;
}

/** The signed-in user's own data for the city (FR-CITY-004). Only the user sees it. */
export function OwnCityCard({ cityName, data, criteria, visits, registeredOn }: OwnCityCardProps) {
  const t = useTranslations('city');
  const format = useFormatter();
  const date = (value: string) => formatVisitDateForDisplay(format, value);

  return (
    <section aria-labelledby="yours" className="rounded-2xl border p-6">
      <h2 id="yours" className="text-lg font-semibold">
        {t('yours')}
      </h2>

      {data.lived && (
        <p className="mt-3 inline-block rounded-full bg-secondary px-3 py-1 text-sm">
          {data.lived.isCurrent ? t('livedHere') : t('livedHerePast')}
          {livedPeriod(data.lived, date, t)}
        </p>
      )}

      <OwnVisits cityId={data.cityId} data={data} visits={visits} registeredOn={registeredOn} />

      <div className="mt-4">
        <h3 className="text-sm text-muted-foreground">{t('yourRating')}</h3>
        {data.rating ? (
          <RatingValue value={data.rating.subjective} className="mt-1 text-lg" />
        ) : (
          <p className="mt-1">{t('notRatedByYou')}</p>
        )}
        {/* Only a visited or lived-in city can be rated (FR-RATE-001, BR-005). */}
        {data.visited && (
          <div className="mt-3">
            <RateButton
              cityId={data.cityId}
              cityName={cityName}
              criteria={criteria}
              rating={data.rating}
            />
          </div>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-sm text-muted-foreground">{t('inYourLists')}</h3>
        {data.lists.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-2">
            {data.lists.map((list) => (
              <li key={list.id} className="rounded-full bg-secondary px-3 py-1 text-sm">
                {list.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1">{t('noLists')}</p>
        )}
      </div>
    </section>
  );
}

/** ", 2018 – 2020", ", since May 2020" or nothing when no period is known. */
function livedPeriod(
  lived: NonNullable<OwnCityData['lived']>,
  date: (value: string) => string,
  t: ReturnType<typeof useTranslations<'city'>>,
): string {
  const { from, to } = lived;
  if (from && to) return `, ${t('livedPeriod', { from: date(from), to: date(to) })}`;
  if (from) return `, ${t('livedSince', { from: date(from) })}`;
  if (to) return `, ${t('livedUntil', { to: date(to) })}`;
  return '';
}
