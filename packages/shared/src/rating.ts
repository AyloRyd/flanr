import { z } from 'zod';
import { paginated } from './pagination.ts';

export const minRating = 1;
export const maxRating = 10;
export const ratingStep = 0.5;

/** A value on the city rating scale: 1 to 10 in steps of 0.5 (BR-006). */
export const ratingValueSchema = z.number().min(minRating).max(maxRating).multipleOf(ratingStep);

/**
 * The arithmetic mean of the criteria a user has rated (BR-007). Criteria that are not rated
 * are simply not in `values`. Null if no criterion is rated.
 */
export function criteriaAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * The value suggested for the subjective rating: the criteria average rounded to the nearest
 * 0.5, an average exactly between two steps rounded up (BR-007, FR-RATE-003).
 */
export function suggestedSubjectiveRating(values: number[]): number | null {
  if (values.length === 0) return null;
  // Counted in whole steps, so that the rounding is exact: floats would turn some
  // averages that lie exactly between two steps into a value just below the middle.
  const steps = values.reduce((sum, value) => sum + Math.round(value / ratingStep), 0);
  const count = values.length;
  return Math.floor((2 * steps + count) / (2 * count)) * ratingStep;
}

/** A criterion users can rate (FR-RATE-002). */
export const criterionSchema = z.object({
  /** Stable name, used as the key of criteria ratings. */
  key: z.string(),
  name: z.string(),
});

export type Criterion = z.infer<typeof criterionSchema>;

export const criterionListSchema = z.object({ items: z.array(criterionSchema) });

/** Criteria ratings by criterion key. Only rated criteria are present. */
export const criteriaRatingsSchema = z.record(z.string(), ratingValueSchema);

export const cityRatingSchema = z.object({
  cityId: z.number().int(),
  /** The user's rating of the city (BR-006). */
  subjective: ratingValueSchema,
  criteria: criteriaRatingsSchema,
  /** Not rounded. Null if no criterion is rated (BR-007). */
  criteriaAverage: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CityRating = z.infer<typeof cityRatingSchema>;

/** The whole rating: criteria that are left out are not rated (BR-008). */
export const setCityRatingSchema = z.object({
  subjective: ratingValueSchema,
  criteria: criteriaRatingsSchema.default({}),
});

export type SetCityRating = z.infer<typeof setCityRatingSchema>;

export const cityRatingPageSchema = paginated(cityRatingSchema);
