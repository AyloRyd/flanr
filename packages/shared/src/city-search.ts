import { z } from 'zod';
import { paginated, paginationQuerySchema } from './pagination.ts';

export const settlementTypes = ['city', 'town', 'village', 'hamlet'] as const;
export const settlementTypeSchema = z.enum(settlementTypes);

export const maxCitySearchQueryLength = 100;

/** How far into the results a search can be paged. Nobody reads that far; it bounds the work. */
export const maxCitySearchResults = 1000;

export const citySearchQuerySchema = paginationQuerySchema.extend({
  /** A name of the city in any language, or the beginning of one (FR-SRCH-001). */
  q: z.string().trim().min(1).max(maxCitySearchQueryLength),
});

export type CitySearchQuery = z.infer<typeof citySearchQuerySchema>;

/** A city in the search results, with what tells cities of the same name apart (FR-SRCH-002). */
export const citySearchResultSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  nameEn: z.string(),
  /**
   * The name that the query matched, if it is neither `name` nor `nameEn`: "Kiev" for Kyiv.
   * Null when one of those two matched.
   */
  matchedName: z.string().nullable(),
  settlementType: settlementTypeSchema,
  population: z.number().int().nullable(),
  country: z.object({ code: z.string(), name: z.string() }),
  /** The first-level region. Null in countries without regions. */
  region: z.string().nullable(),
  /** The municipality, when the city is a part of one and not the municipality itself (BR-017). */
  municipality: z.string().nullable(),
});

export type CitySearchResult = z.infer<typeof citySearchResultSchema>;

export const citySearchPageSchema = paginated(citySearchResultSchema);
