import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import { cityDetailsSchema, citySummaryListSchema, citySummaryQuerySchema } from '@flanr/shared';
import type { AuthEnv } from './auth.ts';
import type { CityStore } from './cities.ts';
import { problem } from './problem.ts';
import { cityParams, json, problemResponse } from './route-helpers.ts';

const getCityRoute = createRoute({
  method: 'get',
  path: '/v1/cities/{cityId}',
  summary: 'A city with the data of its city page (FR-CITY-001, FR-CITY-002)',
  description:
    'Fields that are not known are null. The boundary is simplified to about 10 m and is null for a city mapped as a point only. Open to guests.',
  request: { params: cityParams },
  responses: {
    200: { description: 'The city', ...json(cityDetailsSchema) },
    400: problemResponse('Invalid request'),
    404: problemResponse('City not found'),
  },
});

const citySummariesRoute = createRoute({
  method: 'get',
  path: '/v1/city-summaries',
  summary: 'Short data of several cities at once, for lists of cities',
  description:
    'The lists of a user and the entries of custom lists carry only city IDs; this gives one page of them their names, places and community ratings in one request. The cities come in the order of `ids`; IDs of no city are left out, a repeated ID comes once. Open to guests.',
  request: { query: citySummaryQuerySchema },
  responses: {
    200: { description: 'The cities', ...json(citySummaryListSchema) },
    400: problemResponse('Invalid request'),
  },
});

export function registerCityRoutes(app: OpenAPIHono<AuthEnv>, cities: CityStore): void {
  app.openapi(getCityRoute, async (c) => {
    const city = await cities.find(c.req.valid('param').cityId);
    if (!city) return problem(c, 404, 'City not found') as never;
    return c.json(city, 200);
  });

  app.openapi(citySummariesRoute, async (c) => {
    const ids = [...new Set(c.req.valid('query').ids)];
    return c.json({ items: await cities.summaries(ids) }, 200);
  });
}
