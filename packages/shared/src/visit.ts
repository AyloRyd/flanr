import { z } from 'zod';
import { paginated } from './pagination.ts';

export const visitDatePrecisions = ['day', 'month', 'year'] as const;

export type VisitDatePrecision = (typeof visitDatePrecisions)[number];

/**
 * A visit date as the API takes and returns it. The precision is how much of the date is given
 * (BR-003): `2026`, `2026-05` or `2026-05-10`.
 */
export const visitDateSchema = z
  .string()
  .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, { message: 'Use YYYY, YYYY-MM or YYYY-MM-DD' })
  .refine((value) => parseVisitDate(value) !== null, { message: 'Not a date in the calendar' });

export interface ParsedVisitDate {
  precision: VisitDatePrecision;
  /** The first day of the period, as YYYY-MM-DD. */
  start: string;
}

const visitDatePattern = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/** Reads a visit date. Returns null if it is not a date that exists in the calendar. */
export function parseVisitDate(value: string): ParsedVisitDate | null {
  const match = visitDatePattern.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const start = `${year}-${month ?? '01'}-${day ?? '01'}`;
  const parsed = new Date(`${start}T00:00:00Z`);
  // An impossible date such as 2026-02-30 either fails to parse or rolls over to another day.
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== start) return null;
  return { precision: day ? 'day' : month ? 'month' : 'year', start };
}

/** The date in the form it was entered: the stored first day cut to its precision. */
export function formatVisitDate(start: string, precision: VisitDatePrecision): string {
  return start.slice(0, { year: 4, month: 7, day: 10 }[precision]);
}

/**
 * Today's date in the time zone that is furthest ahead (UTC+14). The API does not know the
 * user's time zone, and a visit logged in the evening in Tokyo must not count as a future one.
 */
export function latestToday(now: Date): string {
  return new Date(now.getTime() + 14 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export type VisitDateProblem = 'date_in_future' | 'date_required';

export const visitDateProblemMessages: Record<VisitDateProblem, string> = {
  date_in_future: 'A visit cannot be in the future.',
  date_required:
    'A visit needs a date, unless you confirm that it took place before you registered.',
};

export interface VisitDateInput {
  /** Null for an undated visit. */
  date: ParsedVisitDate | null;
  /** The user's confirmation that the visit took place before they registered (FR-VIS-003). */
  beforeRegistration: boolean;
}

export interface VisitDateContext {
  /** Today as YYYY-MM-DD, see latestToday. */
  today: string;
  /** The day the user registered, as YYYY-MM-DD. */
  registeredOn: string;
  /** When a visit is edited: the date it has now. */
  previousDate?: ParsedVisitDate | null;
}

/** Whether a visit in this period can have taken place before the user registered. */
export function isBeforeRegistration(date: ParsedVisitDate, registeredOn: string): boolean {
  return date.start < registeredOn;
}

/** Checks a new or changed visit date against BR-002 and BR-003. Returns null if it is allowed. */
export function checkVisitDate(
  input: VisitDateInput,
  context: VisitDateContext,
): VisitDateProblem | null {
  if (input.date) {
    return input.date.start > context.today ? 'date_in_future' : null;
  }
  if (!input.beforeRegistration) return 'date_required';
  // A visit that is known to be from after the registration cannot lose its date (FR-VIS-004).
  const previous = context.previousDate;
  if (previous && !isBeforeRegistration(previous, context.registeredOn)) return 'date_required';
  return null;
}

/** Most undated visits to one city that can be set at once (FR-VIS-005). */
export const maxUndatedVisits = 1000;

export const visitSchema = z.object({
  id: z.number().int(),
  cityId: z.number().int(),
  /** Null for an undated visit. */
  date: visitDateSchema.nullable(),
  datePrecision: z.enum([...visitDatePrecisions, 'none']),
  beforeRegistration: z.boolean(),
  createdAt: z.string(),
});

export type Visit = z.infer<typeof visitSchema>;

const dateFields = {
  date: visitDateSchema.nullable(),
  /** Needed for an undated visit: confirms that it took place before the registration. */
  beforeRegistration: z.boolean().default(false),
};

export const createVisitSchema = z.object({ cityId: z.number().int().positive(), ...dateFields });

export type CreateVisit = z.infer<typeof createVisitSchema>;

export const updateVisitSchema = z.object(dateFields);

export type UpdateVisit = z.infer<typeof updateVisitSchema>;

export const visitPageSchema = paginated(visitSchema);

export const undatedVisitCountSchema = z.object({
  count: z.number().int().min(0).max(maxUndatedVisits),
});

export type UndatedVisitCount = z.infer<typeof undatedVisitCountSchema>;
