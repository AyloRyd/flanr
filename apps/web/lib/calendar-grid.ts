import type { TripCalendar } from '@flanr/shared';

/** One day of the calendar grid. */
export interface CalendarDay {
  /** YYYY-MM-DD. */
  date: string;
  /** Whether the day lies in the period the calendar covers (FR-STAT-003). */
  inPeriod: boolean;
  /** One entry per visit that day. */
  cityIds: number[];
  /** How strongly the day is coloured: 0 without visits, 4 for four visits or more. */
  level: 0 | 1 | 2 | 3 | 4;
}

/** A column of the grid: Monday to Sunday; null for days outside the year. */
export type CalendarWeek = (CalendarDay | null)[];

export interface YearGrid {
  weeks: CalendarWeek[];
  /** The week in which each month starts, for the labels above the grid; 0 is January. */
  monthStarts: { month: number; week: number }[];
}

const dayMs = 24 * 60 * 60 * 1000;
const isoDate = (time: number) => new Date(time).toISOString().slice(0, 10);

export function visitLevel(visits: number): CalendarDay['level'] {
  return Math.min(visits, 4) as CalendarDay['level'];
}

/** The years the calendar's period touches, newest first; none when it is not shown. */
export function calendarYears(calendar: TripCalendar): number[] {
  if (calendar.from === null) return [];
  const first = Number(calendar.from.slice(0, 4));
  const last = Number(calendar.to.slice(0, 4));
  return Array.from({ length: last - first + 1 }, (_, index) => last - index);
}

/**
 * The days of one year in weeks from Monday to Sunday, as the GitHub contribution graph shows
 * them (FR-STAT-003). Days outside the calendar's period carry no visits.
 */
export function yearGrid(calendar: TripCalendar, year: number): YearGrid {
  const visitsOn = new Map(calendar.days.map((day) => [day.date, day.cityIds]));
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year, 11, 31);
  // Monday is 0: getUTCDay counts from Sunday.
  const offset = (new Date(start).getUTCDay() + 6) % 7;
  const weeks: CalendarWeek[] = [];
  const monthStarts: YearGrid['monthStarts'] = [];

  for (let time = start - offset * dayMs; time <= end; time += dayMs) {
    const index = Math.round((time - start) / dayMs) + offset;
    const week = Math.floor(index / 7);
    const column = (weeks[week] ??= []);
    if (time < start) {
      column.push(null);
      continue;
    }
    const date = isoDate(time);
    if (date.endsWith('-01')) monthStarts.push({ month: Number(date.slice(5, 7)) - 1, week });
    const inPeriod = calendar.from !== null && date >= calendar.from && date <= calendar.to;
    const cityIds = (inPeriod && visitsOn.get(date)) || [];
    column.push({ date, inPeriod, cityIds, level: visitLevel(cityIds.length) });
  }
  const last = weeks.at(-1);
  while (last && last.length < 7) last.push(null);
  return { weeks, monthStarts };
}
