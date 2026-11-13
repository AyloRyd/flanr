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

/** The stable name of a criterion: lower-case words joined by underscores. */
export const criterionKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
  .min(2)
  .max(40);

const criterionNameSchema = z.string().trim().min(1).max(60);

/** A criterion as administrators see it (FR-RATE-006). */
export const managedCriterionSchema = criterionSchema.extend({
  /** A criterion that is switched off cannot be rated; its ratings stay stored. */
  active: z.boolean(),
  /** Criteria are shown in ascending order of this number. */
  sortOrder: z.number().int(),
});

export type ManagedCriterion = z.infer<typeof managedCriterionSchema>;

export const managedCriterionListSchema = z.object({ items: z.array(managedCriterionSchema) });

export const createCriterionSchema = z.object({
  key: criterionKeySchema,
  name: criterionNameSchema,
  /** Left out, the criterion goes to the end. */
  sortOrder: z.number().int().min(0).max(100_000).optional(),
});

export type CreateCriterion = z.infer<typeof createCriterionSchema>;

/** The key cannot be changed: stored ratings and clients refer to it. */
export const updateCriterionSchema = z
  .object({
    name: criterionNameSchema,
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(100_000),
  })
  .partial();

export type UpdateCriterion = z.infer<typeof updateCriterionSchema>;

/** A community average: rounded to two decimal places, null without ratings (BR-009). */
const communityAverageSchema = z.number().nullable();

/**
 * What all users together think of a city (BR-009, FR-RATE-005). It counts the ratings of
 * private profiles too and never says whose ratings they are (FR-PRIV-002).
 */
export const communityRatingSchema = z.object({
  cityId: z.number().int(),
  /** The mean of all subjective ratings. */
  average: communityAverageSchema,
  /** The number of ratings. */
  count: z.number().int().min(0),
  /** One entry per criterion that can be rated, in display order. */
  criteria: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      average: communityAverageSchema,
      count: z.number().int().min(0),
    }),
  ),
});

export type CommunityRating = z.infer<typeof communityRatingSchema>;
