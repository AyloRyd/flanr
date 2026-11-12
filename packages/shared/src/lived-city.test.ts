import { describe, expect, it } from 'vitest';
import { checkLivedPeriod } from './lived-city.ts';
import { parseVisitDate } from './visit.ts';

const today = '2026-11-12';
const date = (value: string | null) => (value === null ? null : parseVisitDate(value));
const check = (from: string | null, to: string | null, isCurrent = false) =>
  checkLivedPeriod({ isCurrent, from: date(from), to: date(to) }, today);

describe('checkLivedPeriod (BR-016)', () => {
  it('allows a lived-in city without a period', () => {
    expect(check(null, null)).toBeNull();
    expect(check(null, null, true)).toBeNull();
  });

  it('allows only a start or only an end', () => {
    expect(check('2019', null)).toBeNull();
    expect(check(null, '2023-06')).toBeNull();
  });

  it('allows ends of different precision', () => {
    expect(check('2019-09-01', '2023')).toBeNull();
  });

  it('does not allow a start or an end in the future (BR-003)', () => {
    expect(check('2027', null)).toBe('from_in_future');
    expect(check('2020', '2026-12')).toBe('to_in_future');
  });

  it('does not allow a period that ends before it starts', () => {
    expect(check('2023', '2019')).toBe('to_before_from');
    expect(check('2020-06', '2020-05')).toBe('to_before_from');
  });

  it('allows a period that starts and ends within the same year or month', () => {
    expect(check('2020-05', '2020')).toBeNull();
    expect(check('2020-05-20', '2020-05')).toBeNull();
    expect(check('2020', '2020')).toBeNull();
  });

  it('does not allow an end date for the current city', () => {
    expect(check('2024', '2025', true)).toBe('current_has_end');
    expect(check('2024', null, true)).toBeNull();
  });
});
