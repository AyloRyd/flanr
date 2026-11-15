import { ratingColor } from '@flanr/shared';
import { useFormatter } from 'next-intl';
import { cn } from '@/lib/utils';

/** A rating in the colour of the rating scale (FR-CITY-003, SRS appendix C). */
export function RatingValue({ value, className }: { value: number; className?: string }) {
  const format = useFormatter();

  return (
    <span
      className={cn(
        'inline-flex min-w-12 items-center justify-center rounded-lg px-2 py-1 font-bold text-white tabular-nums',
        className,
      )}
      style={{ backgroundColor: ratingColor(value) }}
    >
      {format.number(value, { maximumFractionDigits: 2 })}
    </span>
  );
}
