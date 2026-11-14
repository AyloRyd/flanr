import { z } from 'zod';
import type { SettlementType } from './city-tiles.ts';
import { paginated, paginationQuerySchema } from './pagination.ts';
import { maxRating, minRating } from './rating.ts';

export const settlementTypes = ['city', 'town', 'village', 'hamlet'] as const;
export const settlementTypeSchema = z.enum(settlementTypes);

export const maxCitySearchQueryLength = 100;

/** How far into the results a search can be paged. Nobody reads that far; it bounds the work. */
export const maxCitySearchResults = 1000;

/**
 * How many ratings a city needs to be listed when the user sorts or filters by community
 * rating and sets no minimum of their own (FR-SRCH-003, OI-011). A rating built from very few
 * ratings says little. To be raised when Flanr has enough ratings.
 */
export const defaultMinRatings = 10;

/** `relevance` is the order of the name search and needs `q`. */
export const citySorts = ['relevance', 'rating', 'ratings', 'population', 'name'] as const;
export const citySortSchema = z.enum(citySorts);

export type CitySort = z.infer<typeof citySortSchema>;

const wholeNumber = z.coerce.number().int().min(0).max(1_000_000_000);

export const citySearchQuerySchema = paginationQuerySchema.extend({
  /** A name of the city in any language, or the beginning of one (FR-SRCH-001). */
  q: z.string().trim().min(1).max(maxCitySearchQueryLength).optional(),
  /** ISO 3166-1 alpha-2 code, in any letter case. */
  country: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .transform((code) => code.toUpperCase())
    .optional(),
  /** A region of the first or second level, by its ID from the list of regions. */
  regionId: z.coerce.number().int().positive().optional(),
  /** One settlement type or several, separated by commas: `city,town`. */
  settlementType: z
    .string()
    .transform((list) => list.split(','))
    .pipe(z.array(settlementTypeSchema).min(1))
    .optional(),
  populationMin: wholeNumber.optional(),
  populationMax: wholeNumber.optional(),
  /** Lists only cities with at least this community rating. */
  minRating: z.coerce.number().min(minRating).max(maxRating).optional(),
  /**
   * Lists only cities with at least this many ratings. Left out, it is `defaultMinRatings`
   * when sorting or filtering by community rating, and 0 otherwise (OI-011).
   */
  minRatings: wholeNumber.optional(),
  /** Left out: `relevance` with `q`, `population` without. */
  sort: citySortSchema.optional(),
  /** Left out: `asc` for `name`, `desc` for the others. `relevance` has one order only. */
  order: z.enum(['asc', 'desc']).optional(),
});

export type CitySearchQuery = z.infer<typeof citySearchQuerySchema>;

export interface CitySearchPlan {
  query: string | undefined;
  country: string | undefined;
  regionId: number | undefined;
  settlementTypes: SettlementType[] | undefined;
  populationMin: number | undefined;
  populationMax: number | undefined;
  minRating: number | undefined;
  minRatings: number;
  sort: CitySort;
  descending: boolean;
}

export type CitySearchProblem = 'relevance_needs_query' | 'population_range';

export const citySearchProblems: Record<CitySearchProblem, { path: string; message: string }> = {
  relevance_needs_query: { path: 'sort', message: 'Sorting by relevance needs a search text.' },
  population_range: {
    path: 'populationMax',
    message: 'The largest population cannot be below the smallest.',
  },
};

/**
 * Fills in what the request left open (FR-SRCH-003): the sorting, its direction and the
 * minimum number of ratings.
 */
export function planCitySearch(
  request: Omit<CitySearchQuery, 'limit' | 'cursor'>,
): CitySearchPlan | { problem: CitySearchProblem } {
  const sort = request.sort ?? (request.q === undefined ? 'population' : 'relevance');
  if (sort === 'relevance' && request.q === undefined) return { problem: 'relevance_needs_query' };
  if (
    request.populationMin !== undefined &&
    request.populationMax !== undefined &&
    request.populationMax < request.populationMin
  ) {
    return { problem: 'population_range' };
  }

  const byCommunityRating = sort === 'rating' || request.minRating !== undefined;
  return {
    query: request.q,
    country: request.country,
    regionId: request.regionId,
    settlementTypes: request.settlementType,
    populationMin: request.populationMin,
    populationMax: request.populationMax,
    minRating: request.minRating,
    minRatings: request.minRatings ?? (byCommunityRating ? defaultMinRatings : 0),
    sort,
    descending: request.order === undefined ? sort !== 'name' : request.order === 'desc',
  };
}

/** A city in the search results, with what tells cities of the same name apart (FR-SRCH-002). */
export const citySearchResultSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  nameEn: z.string(),
  /**
   * The name that the query matched, if it is neither `name` nor `nameEn`: "Kiev" for Kyiv.
   * Null when one of those two matched, and without a search text.
   */
  matchedName: z.string().nullable(),
  settlementType: settlementTypeSchema,
  population: z.number().int().nullable(),
  country: z.object({ code: z.string(), name: z.string() }),
  /** The first-level region. Null in countries without regions. */
  region: z.string().nullable(),
  /** The municipality, when the city is a part of one and not the municipality itself (BR-017). */
  municipality: z.string().nullable(),
  /** The community rating, rounded to two decimal places (BR-009). Null without ratings. */
  rating: z.number().nullable(),
  ratingCount: z.number().int().min(0),
});

export type CitySearchResult = z.infer<typeof citySearchResultSchema>;

export const citySearchPageSchema = paginated(citySearchResultSchema);

/** A country that has cities in Flanr, for the country filter. */
export const countrySchema = z.object({
  /** ISO 3166-1 alpha-2. */
  code: z.string(),
  name: z.string(),
  nameLocal: z.string(),
});

export type Country = z.infer<typeof countrySchema>;

export const countryListSchema = z.object({ items: z.array(countrySchema) });

/** A region of a country, for the region filter. */
export const regionSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  nameLocal: z.string(),
  /** 1 for a first-level region (a state, a province), 2 for a second-level one (a district). */
  level: z.number().int(),
});

export type Region = z.infer<typeof regionSchema>;

export const regionListSchema = z.object({ items: z.array(regionSchema) });
