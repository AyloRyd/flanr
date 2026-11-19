import { describe, expect, it } from 'vitest';
import { buildTripCalendar, tripCalendarStart, type CalendarVisit } from './trip-calendar.ts';

const day = (date: string, cityId = 1): CalendarVisit => ({ cityId, date, precision: 'day' });
const month = (date: string): CalendarVisit => ({ cityId: 1, date, precision: 'month' });
const year = (date: string): CalendarVisit => ({ cityId: 1, date, precision: 'year' });
const undated = (): CalendarVisit => ({ cityId: 1, date: null, precision: 'none' });

const registeredOn = '2026-03-01';
const today = '2026-11-20';

describe('trip calendar (FR-STAT-003)', () => {
  it('counts the visits of a day, so that two visits colour it stronger than one', () => {
    const calendar = buildTripCalendar(
      [day('2026-05-10', 1), day('2026-05-10', 2), day('2026-05-11', 1)],
      registeredOn,
      today,
    );

    expect(calendar.days).toEqual([
      { date: '2026-05-10', cityIds: [1, 2] },
      { date: '2026-05-11', cityIds: [1] },
    ]);
  });

  it('places no visit with month precision on a day', () => {
    const calendar = buildTripCalendar(
      [day('2026-07-01'), month('2026-06-01')],
      registeredOn,
      today,
    );

    expect(calendar.days.map((entry) => entry.date)).toEqual(['2026-07-01']);
    expect(calendar.visitsBefore).toBe(1);
  });

  it('starts on the registration date when there are undated visits, and counts them', () => {
    const visits = [...Array.from({ length: 50 }, undated), day('2026-04-02')];

    const calendar = buildTripCalendar(visits, registeredOn, today);

    expect(calendar.from).toBe('2026-03-01');
    expect(calendar.visitsBefore).toBe(50);
  });

  it('starts after the latest month-precision visit and counts the day visits before it', () => {
    const calendar = buildTripCalendar(
      [day('2026-01-10'), month('2026-05-01'), day('2026-07-04')],
      '2025-12-01',
      today,
    );

    expect(calendar.from).toBe('2026-06-01');
    expect(calendar.days).toEqual([{ date: '2026-07-04', cityIds: [1] }]);
    expect(calendar.visitsBefore).toBe(2);
  });

  it('is not shown with a visit with year precision in the current year', () => {
    const calendar = buildTripCalendar(
      [day('2026-02-01'), year('2026-01-01')],
      '2025-01-01',
      today,
    );

    expect(calendar.from).toBeNull();
    expect(calendar.days).toEqual([]);
    expect(calendar.visitsBefore).toBe(2);
  });

  it('starts on the earliest visit when all visits have days (FR-STAT-004)', () => {
    expect(tripCalendarStart([day('2026-08-01'), day('2026-02-03')], registeredOn)).toBe(
      '2026-02-03',
    );
  });

  it('moves a December visit with month precision to the first of January', () => {
    expect(tripCalendarStart([month('2025-12-01')], '2025-01-01')).toBe('2026-01-01');
  });

  it('has no period without visits', () => {
    expect(buildTripCalendar([], registeredOn, today)).toEqual({
      from: null,
      to: today,
      days: [],
      visitsBefore: 0,
    });
  });
});
