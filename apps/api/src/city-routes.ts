import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import { cityDetailsSchema } from '@flanr/shared';
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

export function registerCityRoutes(app: OpenAPIHono<AuthEnv>, cities: CityStore): void {
  app.openapi(getCityRoute, async (c) => {
    const city = await cities.find(c.req.valid('param').cityId);
    if (!city) return problem(c, 404, 'City not found') as never;
    return c.json(city, 200);
  });
}
