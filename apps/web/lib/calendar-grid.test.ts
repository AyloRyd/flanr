import type { TripCalendar } from '@flanr/shared';
import { describe, expect, it } from 'vitest';
import { calendarYears, visitLevel, yearGrid } from './calendar-grid.ts';

const calendar: TripCalendar = {
  from: '2026-01-07',
  to: '2026-11-20',
  days: [
    { date: '2026-01-07', cityIds: [1] },
    { date: '2026-04-04', cityIds: [2, 3, 4, 5] },
  ],
  visitsBefore: 0,
};

describe('trip calendar grid (FR-STAT-003)', () => {
  it('puts the year into weeks from Monday to Sunday', () => {
    const { weeks } = yearGrid(calendar, 2026);

    // 1 January 2026 is a Thursday.
    expect(weeks[0]?.slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0]?.[3]?.date).toBe('2026-01-01');
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(365);
  });

  it('colours a day by its number of visits, up to four', () => {
    const days = yearGrid(calendar, 2026).weeks.flat();
    const day = (date: string) => days.find((entry) => entry?.date === date);

    expect(day('2026-01-07')).toMatchObject({ level: 1, cityIds: [1], inPeriod: true });
    expect(day('2026-04-04')?.level).toBe(4);
    expect(day('2026-04-05')).toMatchObject({ level: 0, inPeriod: true });
  });

  it('marks the days outside the period', () => {
    const days = yearGrid(calendar, 2026).weeks.flat();

    expect(days.find((day) => day?.date === '2026-01-06')?.inPeriod).toBe(false);
    expect(days.find((day) => day?.date === '2026-12-01')?.inPeriod).toBe(false);
  });

  it('knows the week in which every month starts', () => {
    const { monthStarts } = yearGrid(calendar, 2026);

    expect(monthStarts).toHaveLength(12);
    expect(monthStarts[0]).toEqual({ month: 0, week: 0 });
    expect(monthStarts[1]).toEqual({ month: 1, week: 4 });
  });

  it('lists the years of the period, newest first, and none without a period', () => {
    expect(calendarYears({ ...calendar, from: '2024-12-30' })).toEqual([2026, 2025, 2024]);
    expect(calendarYears({ ...calendar, from: null })).toEqual([]);
    expect(visitLevel(9)).toBe(4);
  });
});
