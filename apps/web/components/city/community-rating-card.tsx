import type { CommunityRating } from '@flanr/shared';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { RatingValue } from '@/components/city/rating-value';

interface CommunityRatingCardProps {
  rating: CommunityRating;
  /** The criteria folded away until opened; for the city panel, which has little room. */
  collapsibleCriteria?: boolean;
}

/** The community rating and its criteria (FR-CITY-003, FR-RATE-005). */
export function CommunityRatingCard({
  rating,
  collapsibleCriteria = false,
}: CommunityRatingCardProps) {
  const t = useTranslations('city');
  const criteria = (
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
  );

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
          {collapsibleCriteria ? (
            <details className="group mt-6">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                {t('criteria')}
                <ChevronDown
                  aria-hidden
                  className="size-4 transition-transform group-open:rotate-180"
                />
              </summary>
              {criteria}
            </details>
          ) : (
            <>
              <h3 className="mt-6 text-sm font-medium text-muted-foreground">{t('criteria')}</h3>
              {criteria}
            </>
          )}
        </>
      )}
    </section>
  );
}
