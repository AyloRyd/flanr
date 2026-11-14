import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import {
  citySearchPageSchema,
  citySearchProblems,
  citySearchQuerySchema,
  countryListSchema,
  maxCitySearchResults,
  planCitySearch,
  regionListSchema,
  toPage,
} from '@flanr/shared';
import type { AuthEnv } from './auth.ts';
import type { CitySearch, Geography } from './city-search.ts';
import { problem } from './problem.ts';
import { invalidCursor, json, problemResponse } from './route-helpers.ts';

const searchCitiesRoute = createRoute({
  method: 'get',
  path: '/v1/cities',
  summary: 'Find, filter and sort cities (FR-SRCH-001…003)',
  description:
    'With `q`: searches the local, English, alternative and former names in all languages, without letter case and diacritics, and tolerates small typos. Exact names come first, then names that start with the query, then close spellings; within each group the largest city first. Without `q`: all cities. Either list can be filtered and sorted. When it is sorted or filtered by community rating, only cities with at least `minRatings` ratings are listed, 10 unless the request says otherwise. Open to guests.',
  request: { query: citySearchQuerySchema },
  responses: {
    200: { description: 'One page of cities', ...json(citySearchPageSchema) },
    400: problemResponse('Invalid request'),
  },
});

const listCountriesRoute = createRoute({
  method: 'get',
  path: '/v1/countries',
  summary: 'The countries that have cities, for the country filter (FR-SRCH-003)',
  responses: {
    200: { description: 'The countries by English name', ...json(countryListSchema) },
  },
});

const listRegionsRoute = createRoute({
  method: 'get',
  path: '/v1/countries/{code}/regions',
  summary: 'The regions of a country, for the region filter (FR-SRCH-003)',
  request: { params: z.object({ code: z.string().regex(/^[A-Za-z]{2}$/) }) },
  responses: {
    200: {
      description: 'First-level regions, then second-level ones, by English name',
      ...json(regionListSchema),
    },
    400: problemResponse('Invalid request'),
  },
});

export function registerCitySearchRoutes(
  app: OpenAPIHono<AuthEnv>,
  searchCities: CitySearch,
  geography: Geography,
): void {
  app.openapi(searchCitiesRoute, async (c) => {
    const { limit, cursor, ...request } = c.req.valid('query');
    const plan = planCitySearch(request);
    if ('problem' in plan) {
      return problem(c, 400, 'Invalid request', undefined, [
        citySearchProblems[plan.problem],
      ]) as never;
    }
    // The results have no stable key to continue from, so the cursor is how many were read.
    const offset = cursor === undefined ? 0 : Number(cursor);
    if (!Number.isSafeInteger(offset) || offset < 0) return invalidCursor(c) as never;
    if (offset >= maxCitySearchResults) return c.json({ items: [], nextCursor: null }, 200);

    // One row more than the page size shows whether another page exists.
    const rows = await searchCities({ ...plan, limit: limit + 1, offset });
    return c.json(
      toPage(rows, limit, () => String(offset + limit)),
      200,
    );
  });

  app.openapi(listCountriesRoute, async (c) => c.json({ items: await geography.countries() }, 200));

  app.openapi(listRegionsRoute, async (c) =>
    c.json({ items: await geography.regions(c.req.valid('param').code.toUpperCase()) }, 200),
  );
}
