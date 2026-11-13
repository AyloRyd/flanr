import { z } from 'zod';
import { paginated } from './pagination.ts';

/** A city in the Planned list (FR-LIST-002). */
export const plannedCitySchema = z.object({
  cityId: z.number().int(),
  addedAt: z.string(),
});

export type PlannedCity = z.infer<typeof plannedCitySchema>;

export const plannedCityPageSchema = paginated(plannedCitySchema);

/**
 * A city in the Visited list (FR-LIST-001). The list is derived: a city is in it when the user
 * has a visit to it or has marked it as a lived-in city (BR-004).
 */
export const visitedCitySchema = z.object({
  cityId: z.number().int(),
  /** Dated and undated visits together. Zero for a lived-in city without visits (BR-016). */
  visitCount: z.number().int().min(0),
  livedIn: z.boolean(),
});

export type VisitedCity = z.infer<typeof visitedCitySchema>;

export const visitedCityPageSchema = paginated(visitedCitySchema);

/**
 * A city in the Visited list of another user. Only the city: the number of visits and the
 * lived-in mark stay with the owner, because a city without visits would give away where
 * the user lives or lived, also when the home location is hidden (FR-PROF-003).
 */
export const publicVisitedCitySchema = visitedCitySchema.pick({ cityId: true });

export type PublicVisitedCity = z.infer<typeof publicVisitedCitySchema>;

export const publicVisitedCityPageSchema = paginated(publicVisitedCitySchema);
