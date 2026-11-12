import { z } from 'zod';
import { paginated } from './pagination.ts';
import { visitDateSchema, type ParsedVisitDate } from './visit.ts';

export type LivedPeriodProblem =
  'from_in_future' | 'to_in_future' | 'to_before_from' | 'current_has_end';

export const livedPeriodProblems: Record<LivedPeriodProblem, { path: string; message: string }> = {
  from_in_future: { path: 'from', message: 'The period cannot start in the future.' },
  to_in_future: { path: 'to', message: 'The period cannot end in the future.' },
  to_before_from: { path: 'to', message: 'The period cannot end before it starts.' },
  current_has_end: { path: 'to', message: 'The city you live in now cannot have an end date.' },
};

export interface LivedPeriodInput {
  isCurrent: boolean;
  from: ParsedVisitDate | null;
  to: ParsedVisitDate | null;
}

/** The last day a date of this precision can stand for. Only used for comparing. */
function latestDay(date: ParsedVisitDate): string {
  // "31" sorts after every real day of a month, which is all a string comparison needs.
  if (date.precision === 'year') return `${date.start.slice(0, 4)}-12-31`;
  if (date.precision === 'month') return `${date.start.slice(0, 7)}-31`;
  return date.start;
}

/**
 * Checks the optional period of a lived-in city (BR-016). Its ends follow the rules of visit
 * dates (BR-003). `today` is YYYY-MM-DD, see latestToday. Returns null if the period is allowed.
 */
export function checkLivedPeriod(
  input: LivedPeriodInput,
  today: string,
): LivedPeriodProblem | null {
  if (input.from && input.from.start > today) return 'from_in_future';
  if (input.to && input.to.start > today) return 'to_in_future';
  if (input.isCurrent && input.to) return 'current_has_end';
  // "From May 2020 to 2020" is fine: the year ends after the month starts.
  if (input.from && input.to && latestDay(input.to) < input.from.start) return 'to_before_from';
  return null;
}

export const livedCitySchema = z.object({
  cityId: z.number().int(),
  /** The city the user lives in now. At most one per user; it is the user's home location. */
  isCurrent: z.boolean(),
  from: visitDateSchema.nullable(),
  to: visitDateSchema.nullable(),
});

export type LivedCity = z.infer<typeof livedCitySchema>;

export const setLivedCitySchema = z.object({
  isCurrent: z.boolean(),
  from: visitDateSchema.nullable().default(null),
  to: visitDateSchema.nullable().default(null),
});

export type SetLivedCity = z.infer<typeof setLivedCitySchema>;

export const livedCityPageSchema = paginated(livedCitySchema);
