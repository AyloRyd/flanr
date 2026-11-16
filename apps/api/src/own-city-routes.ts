import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import { ownCityDataSchema } from '@flanr/shared';
import type { AuthEnv } from './auth.ts';
import type { DefaultListStore } from './default-lists.ts';
import type { ListStore } from './lists.ts';
import type { LivedCityStore } from './lived-cities.ts';
import { problem } from './problem.ts';
import type { RatingStore } from './ratings.ts';
import {
  bearerSecurity,
  cityParams,
  commonErrors,
  json,
  problemResponse,
} from './route-helpers.ts';

const ownCityRoute = createRoute({
  method: 'get',
  path: '/v1/me/cities/{cityId}',
  summary: "The signed-in user's own data for a city (FR-CITY-004)",
  description:
    'Visit counts, the lived-in mark, whether the city is visited or planned, the rating and the custom lists that contain it. The dated visits are listed by `GET /v1/visits?cityId=`.',
  security: bearerSecurity,
  request: { params: cityParams },
  responses: {
    200: { description: "The user's data for the city", ...json(ownCityDataSchema) },
    ...commonErrors,
    404: problemResponse('City not found'),
  },
});

export interface OwnCityStores {
  defaultLists: DefaultListStore;
  livedCities: LivedCityStore;
  ratings: RatingStore;
  lists: ListStore;
}

/** Under /v1/me, so the app already asks for a signed-in user (NFR-SEC-003). */
export function registerOwnCityRoutes(
  app: OpenAPIHono<AuthEnv>,
  { defaultLists, livedCities, ratings, lists }: OwnCityStores,
): void {
  app.openapi(ownCityRoute, async (c) => {
    const { cityId } = c.req.valid('param');
    if (!(await defaultLists.cityExists(cityId))) return problem(c, 404, 'City not found') as never;

    const userId = c.get('user').id;
    const [status, lived, rating, containing] = await Promise.all([
      defaultLists.cityStatus(userId, cityId),
      livedCities.find(userId, cityId),
      ratings.find(userId, cityId),
      lists.containing(userId, cityId),
    ]);
    return c.json(
      {
        cityId,
        ...status,
        lived: lived && { isCurrent: lived.isCurrent, from: lived.from, to: lived.to },
        rating,
        lists: containing,
      },
      200,
    );
  });
}
