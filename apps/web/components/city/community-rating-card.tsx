import type { CommunityRating } from '@flanr/shared';
import { useTranslations } from 'next-intl';
import { RatingValue } from '@/components/city/rating-value';

/** The community rating and its criteria (FR-CITY-003, FR-RATE-005). */
export function CommunityRatingCard({ rating }: { rating: CommunityRating }) {
  const t = useTranslations('city');

  return (
    <section aria-labelledby="community-rating" className="rounded-2xl border p-6">
      <h2 id="community-rating" className="text-lg font-semibold">
        {t('communityRating')}
      </h2>
      {rating.average === null ? (
        <p className="mt-3 text-muted-foreground">{t('noRatings')}</p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <RatingValue value={rating.average} className="text-2xl" />
            <span className="text-muted-foreground">
              {t('ratingCount', { count: rating.count })}
            </span>
          </div>
          <h3 className="mt-6 text-sm font-medium text-muted-foreground">{t('criteria')}</h3>
          <dl className="mt-2 divide-y">
            {rating.criteria.map((criterion) => (
              <div key={criterion.key} className="flex items-center justify-between gap-4 py-2">
                <dt>{criterion.name}</dt>
                <dd className="flex items-center gap-2 text-sm text-muted-foreground">
                  {criterion.average === null ? (
                    t('notRated')
                  ) : (
                    <>
                      {t('ratingCount', { count: criterion.count })}
                      <RatingValue value={criterion.average} className="text-sm" />
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
