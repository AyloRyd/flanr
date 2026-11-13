import { describe, expect, it } from 'vitest';
import {
  criteriaAverage,
  ratingValueSchema,
  setCityRatingSchema,
  suggestedSubjectiveRating,
} from './rating.ts';

describe('ratingValueSchema (BR-006)', () => {
  it.each([1, 1.5, 7, 7.5, 10])('accepts %s', (value) => {
    expect(ratingValueSchema.safeParse(value).success).toBe(true);
  });

  it.each([0, 0.5, 7.3, 7.25, 10.5, 11, Number.NaN])('rejects %s', (value) => {
    expect(ratingValueSchema.safeParse(value).success).toBe(false);
  });
});

describe('setCityRatingSchema (BR-006)', () => {
  it('needs the subjective rating', () => {
    expect(setCityRatingSchema.safeParse({ criteria: { safety: 8 } }).success).toBe(false);
  });

  it('does not need criteria ratings', () => {
    expect(setCityRatingSchema.parse({ subjective: 7.5 })).toEqual({
      subjective: 7.5,
      criteria: {},
    });
  });

  it('rejects a criterion rating off the scale', () => {
    const result = setCityRatingSchema.safeParse({ subjective: 7, criteria: { safety: 7.3 } });

    expect(result.success).toBe(false);
  });
});

describe('criteriaAverage (BR-007)', () => {
  it('is the mean of the rated criteria', () => {
    expect(criteriaAverage([7, 8, 9])).toBe(8);
    expect(criteriaAverage([7, 7.5])).toBe(7.25);
  });

  it('does not exist without rated criteria', () => {
    expect(criteriaAverage([])).toBeNull();
  });
});

describe('suggestedSubjectiveRating (BR-007, FR-RATE-003)', () => {
  it('suggests 8 for criteria ratings of 7, 8 and 9', () => {
    expect(suggestedSubjectiveRating([7, 8, 9])).toBe(8);
  });

  it('rounds an average exactly between two steps up: 7.25 becomes 7.5', () => {
    expect(suggestedSubjectiveRating([7, 7.5])).toBe(7.5);
    expect(suggestedSubjectiveRating([7.5, 8])).toBe(8);
  });

  it.each([
    [[7, 7, 7.5], 7], // 7.17
    [[7, 7.5, 7.5], 7.5], // 7.33
    [[1, 1, 1, 1, 1, 10], 2.5], // 2.5
    [[8, 8, 8, 8, 8, 9.5], 8.5], // 8.25, exactly between
    [[10, 10], 10],
    [[1], 1],
  ])('rounds the average of %j to %s', (values, suggested) => {
    expect(suggestedSubjectiveRating(values)).toBe(suggested);
  });

  it('suggests nothing without rated criteria', () => {
    expect(suggestedSubjectiveRating([])).toBeNull();
  });
});
