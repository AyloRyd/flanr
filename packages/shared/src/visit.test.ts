import { describe, expect, it } from 'vitest';
import {
  checkVisitDate,
  formatVisitDate,
  latestToday,
  parseVisitDate,
  visitDateSchema,
  type ParsedVisitDate,
} from './visit.ts';

const date = (value: string): ParsedVisitDate => {
  const parsed = parseVisitDate(value);
  if (!parsed) throw new Error(`Invalid test date ${value}`);
  return parsed;
};

describe('parseVisitDate (BR-003, FR-VIS-002)', () => {
  it('takes the precision from how much of the date is given', () => {
    expect(parseVisitDate('2026-05-10')).toEqual({ precision: 'day', start: '2026-05-10' });
    expect(parseVisitDate('2026-05')).toEqual({ precision: 'month', start: '2026-05-01' });
    expect(parseVisitDate('2026')).toEqual({ precision: 'year', start: '2026-01-01' });
  });

  it.each(['2026-02-30', '2026-13', '2026-00-10', '10.05.2026', '2026-5-1', '', '26'])(
    'rejects %j',
    (value) => {
      expect(parseVisitDate(value)).toBeNull();
      expect(visitDateSchema.safeParse(value).success).toBe(false);
    },
  );

  it('accepts 29 February in a leap year only', () => {
    expect(parseVisitDate('2024-02-29')).not.toBeNull();
    expect(parseVisitDate('2026-02-29')).toBeNull();
  });
});

describe('formatVisitDate', () => {
  it('cuts the stored first day back to the precision', () => {
    expect(formatVisitDate('2026-05-01', 'month')).toBe('2026-05');
    expect(formatVisitDate('2026-01-01', 'year')).toBe('2026');
    expect(formatVisitDate('2026-05-10', 'day')).toBe('2026-05-10');
  });
});

describe('latestToday', () => {
  it('is the date in the time zone furthest ahead', () => {
    expect(latestToday(new Date('2026-11-12T09:59:00Z'))).toBe('2026-11-12');
    expect(latestToday(new Date('2026-11-12T10:00:00Z'))).toBe('2026-11-13');
  });
});

describe('checkVisitDate', () => {
  const context = { today: '2026-11-12', registeredOn: '2026-03-01' };

  describe('BR-003: a visit date must not be in the future', () => {
    it('allows today and earlier days', () => {
      expect(checkVisitDate({ date: date('2026-11-12'), beforeRegistration: false }, context)).toBe(
        null,
      );
      expect(checkVisitDate({ date: date('1999-07-04'), beforeRegistration: false }, context)).toBe(
        null,
      );
    });

    it('rejects tomorrow', () => {
      expect(checkVisitDate({ date: date('2026-11-13'), beforeRegistration: false }, context)).toBe(
        'date_in_future',
      );
    });

    it('allows the current month and year, which have already begun', () => {
      expect(checkVisitDate({ date: date('2026-11'), beforeRegistration: false }, context)).toBe(
        null,
      );
      expect(checkVisitDate({ date: date('2026'), beforeRegistration: false }, context)).toBe(null);
    });

    it('rejects a month or a year that has not begun', () => {
      expect(checkVisitDate({ date: date('2026-12'), beforeRegistration: false }, context)).toBe(
        'date_in_future',
      );
      expect(checkVisitDate({ date: date('2027'), beforeRegistration: false }, context)).toBe(
        'date_in_future',
      );
    });
  });

  describe('BR-002: only a visit from before the registration may have no date', () => {
    it('allows an undated visit that the user confirms was before the registration (FR-VIS-003)', () => {
      expect(checkVisitDate({ date: null, beforeRegistration: true }, context)).toBe(null);
    });

    it('asks for a date without that confirmation (FR-VIS-003)', () => {
      expect(checkVisitDate({ date: null, beforeRegistration: false }, context)).toBe(
        'date_required',
      );
    });

    it('allows a dated visit after the registration with any precision (FR-VIS-004)', () => {
      expect(checkVisitDate({ date: date('2026-05'), beforeRegistration: false }, context)).toBe(
        null,
      );
    });

    it('does not let a visit from after the registration lose its date (FR-VIS-004)', () => {
      const input = { date: null, beforeRegistration: true };

      expect(checkVisitDate(input, { ...context, previousDate: date('2026-05-10') })).toBe(
        'date_required',
      );
      expect(checkVisitDate(input, { ...context, previousDate: date('2026-03-01') })).toBe(
        'date_required',
      );
    });

    it('lets a visit from before the registration lose its date', () => {
      const input = { date: null, beforeRegistration: true };

      expect(checkVisitDate(input, { ...context, previousDate: date('2025-08') })).toBe(null);
      // The year had begun before the registration, so the visit can be from before it.
      expect(checkVisitDate(input, { ...context, previousDate: date('2026') })).toBe(null);
    });
  });
});
