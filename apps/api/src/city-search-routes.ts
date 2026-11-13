import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import {
  citySearchPageSchema,
  citySearchQuerySchema,
  maxCitySearchResults,
  toPage,
} from '@flanr/shared';
import type { AuthEnv } from './auth.ts';
import type { CitySearch } from './city-search.ts';
import { invalidCursor, json, problemResponse } from './route-helpers.ts';

const searchCitiesRoute = createRoute({
  method: 'get',
  path: '/v1/cities',
  summary: 'Find cities by name (FR-SRCH-001, FR-SRCH-002)',
  description:
    'Searches the local, English, alternative and former names in all languages, without letter case and diacritics, and tolerates small typos. Exact names come first, then names that start with the query, then close spellings; within each group the largest city first. Open to guests.',
  request: { query: citySearchQuerySchema },
  responses: {
    200: { description: 'One page of cities, best match first', ...json(citySearchPageSchema) },
    400: problemResponse('Invalid request'),
  },
});

export function registerCitySearchRoutes(
  app: OpenAPIHono<AuthEnv>,
  searchCities: CitySearch,
): void {
  app.openapi(searchCitiesRoute, async (c) => {
    const { q, limit, cursor } = c.req.valid('query');
    // The results have no stable key to continue from, so the cursor is how many were read.
    const offset = cursor === undefined ? 0 : Number(cursor);
    if (!Number.isSafeInteger(offset) || offset < 0) return invalidCursor(c) as never;
    if (offset >= maxCitySearchResults) return c.json({ items: [], nextCursor: null }, 200);

    // One row more than the page size shows whether another page exists.
    const rows = await searchCities({ query: q, limit: limit + 1, offset });
    return c.json(
      toPage(rows, limit, () => String(offset + limit)),
      200,
    );
  });
}
