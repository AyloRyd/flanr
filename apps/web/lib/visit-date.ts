import { parseVisitDate } from '@flanr/shared';
import type { createFormatter } from 'next-intl';

type Formatter = ReturnType<typeof createFormatter>;

/**
 * A visit date in the user's locale, as precise as it was entered (BR-003): "10 May 2026",
 * "May 2026" or "2026". Dates are calendar days, so they are formatted in UTC.
 */
export function formatVisitDateForDisplay(format: Formatter, value: string): string {
  const parsed = parseVisitDate(value);
  if (!parsed) return value;
  const date = new Date(`${parsed.start}T00:00:00Z`);
  switch (parsed.precision) {
    case 'day':
      return format.dateTime(date, { dateStyle: 'medium', timeZone: 'UTC' });
    case 'month':
      return format.dateTime(date, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    case 'year':
      return value;
  }
}
