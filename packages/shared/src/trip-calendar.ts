import { z } from 'zod';
import type { VisitDatePrecision } from './visit.ts';

/**
 * The trip calendar of a user (FR-STAT-003): the days of a period with the visits on each.
 * Only visits with day precision are placed on days (BR-012).
 */
export const tripCalendarSchema = z.object({
  /** The first day of the period, as YYYY-MM-DD; null when the calendar is not shown. */
  from: z.string().nullable(),
  /** The last day of the period: today. */
  to: z.string(),
  /** The days of the period with visits, oldest first. */
  days: z.array(
    z.object({
      date: z.string(),
      /** One entry per visit; a city visited twice that day is in it twice. */
      cityIds: z.array(z.number().int()),
    }),
  ),
  /** Visits that are not on the calendar: undated ones, less precise ones and earlier ones. */
  visitsBefore: z.number().int().min(0),
});

export type TripCalendar = z.infer<typeof tripCalendarSchema>;

/** A visit as the calendar sees it. `date` is the first day of its period, null if undated. */
export interface CalendarVisit {
  cityId: number;
  date: string | null;
  precision: VisitDatePrecision | 'none';
}

/** The day after the month or year that starts on `date`, as YYYY-MM-DD. */
function dayAfterPeriod(date: string, precision: 'month' | 'year'): string {
  const [year = 0, month = 1] = date.split('-').map(Number);
  return precision === 'year'
    ? `${year + 1}-01-01`
    : month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

/**
 * The first day of the calendar's period: the latest of the earliest visit, the registration
 * date when the user has undated visits, and the day after the latest visit with month or year
 * precision (FR-STAT-003). Null without any visit. Dates compare as YYYY-MM-DD text.
 */
export function tripCalendarStart(visits: CalendarVisit[], registeredOn: string): string | null {
  if (visits.length === 0) return null;
  const candidates: string[] = [];
  if (visits.some((visit) => visit.precision === 'none')) {
    // Undated visits lie before the registration (BR-002), so the earliest visit does too.
    candidates.push(registeredOn);
  } else {
    const dated = visits.flatMap((visit) => (visit.date ? [visit.date] : []));
    candidates.push(dated.reduce((a, b) => (a < b ? a : b)));
  }
  for (const visit of visits) {
    if (visit.date && (visit.precision === 'month' || visit.precision === 'year')) {
      candidates.push(dayAfterPeriod(visit.date, visit.precision));
    }
  }
  return candidates.reduce((a, b) => (a > b ? a : b));
}

/** The trip calendar from all visits of a user (FR-STAT-003, FR-STAT-004). */
export function buildTripCalendar(
  visits: CalendarVisit[],
  registeredOn: string,
  today: string,
): TripCalendar {
  const start = tripCalendarStart(visits, registeredOn);
  const from = start !== null && start <= today ? start : null;
  const byDay = new Map<string, number[]>();
  for (const visit of visits) {
    const onCalendar =
      from !== null &&
      visit.precision === 'day' &&
      visit.date !== null &&
      visit.date >= from &&
      visit.date <= today;
    if (!onCalendar || visit.date === null) continue;
    byDay.set(visit.date, [...(byDay.get(visit.date) ?? []), visit.cityId]);
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, cityIds]) => ({ date, cityIds }));
  const placed = days.reduce((sum, day) => sum + day.cityIds.length, 0);
  return { from, to: today, days, visitsBefore: visits.length - placed };
}
