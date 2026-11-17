import { z } from 'zod';
import { settlementTypeSchema } from './city-search.ts';

/** What the map needs to place a city and size its marker (FR-MAP-005). */
export const mapCitySchema = z.object({
  cityId: z.number().int(),
  longitude: z.number(),
  latitude: z.number(),
  settlementType: settlementTypeSchema,
  population: z.number().int().nullable(),
});

export type MapCity = z.infer<typeof mapCitySchema>;

/**
 * A city of the Visited list on the map, with what the map modes show (FR-MAP-005). As in the
 * Visited list, which lived-in city is the current one is not part of it (FR-PROF-003).
 */
export const visitedMapCitySchema = mapCitySchema.extend({
  /** Dated and undated visits together. Zero for a lived-in city without visits (BR-016). */
  visitCount: z.number().int().min(0),
  livedIn: z.boolean(),
  /** The user's subjective rating; null if the user has not rated the city. */
  rating: z.number().nullable(),
});

export type VisitedMapCity = z.infer<typeof visitedMapCitySchema>;

/**
 * All cities of a user's map at once: the Visited list and the Planned list (FR-MAP-005,
 * FR-MAP-006). Not paginated, because the map shows them all together.
 */
export const userMapSchema = z.object({
  visited: z.array(visitedMapCitySchema),
  planned: z.array(mapCitySchema),
});

export type UserMap = z.infer<typeof userMapSchema>;
