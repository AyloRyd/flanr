import type { OwnCityData, Visit } from '@flanr/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { RatingValue } from '@/components/city/rating-value';
import { formatVisitDateForDisplay } from '@/lib/visit-date';

interface OwnCityCardProps {
  data: OwnCityData;
  /** The newest dated visits. */
  visits: Visit[];
}

/** The signed-in user's own data for the city (FR-CITY-004). Only the user sees it. */
export function OwnCityCard({ data, visits }: OwnCityCardProps) {
  const t = useTranslations('city');
  const format = useFormatter();
  const date = (value: string) => formatVisitDateForDisplay(format, value);

  const datedVisits = visits.filter((visit) => visit.date !== null);
  const moreDated = data.visitCount - data.undatedVisitCount - datedVisits.length;

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

      <div className="mt-4">
        <p className="font-medium">{t('visits', { count: data.visitCount })}</p>
        {datedVisits.length > 0 && (
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {datedVisits.map((visit) => (
              <li key={visit.id}>{visit.date && date(visit.date)}</li>
            ))}
            {moreDated > 0 && <li>{t('moreVisits', { count: moreDated })}</li>}
          </ul>
        )}
        {data.undatedVisitCount > 0 && (
          <p className="mt-1 text-muted-foreground">
            {t('undatedVisits', { count: data.undatedVisitCount })}
          </p>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-sm text-muted-foreground">{t('yourRating')}</h3>
        {data.rating ? (
          <RatingValue value={data.rating.subjective} className="mt-1 text-lg" />
        ) : (
          <p className="mt-1">{t('notRatedByYou')}</p>
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
