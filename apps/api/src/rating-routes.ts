import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import {
  cityRatingPageSchema,
  cityRatingSchema,
  communityRatingSchema,
  criterionListSchema,
  paginationQuerySchema,
  setCityRatingSchema,
  toPage,
} from '@flanr/shared';
import type { AuthEnv } from './auth.ts';
import { problem } from './problem.ts';
import type { RatingStore } from './ratings.ts';
import {
  bearerSecurity,
  cityParams,
  commonErrors,
  idFromCursor,
  invalidCursor,
  json,
  problemResponse,
} from './route-helpers.ts';

const listCriteriaRoute = createRoute({
  method: 'get',
  path: '/v1/criteria',
  summary: 'The criteria a city can be rated by (FR-RATE-002)',
  responses: {
    200: { description: 'The criteria in display order', ...json(criterionListSchema) },
  },
});

const listRatingsRoute = createRoute({
  method: 'get',
  path: '/v1/ratings',
  summary: 'The city ratings of the signed-in user',
  security: bearerSecurity,
  request: { query: paginationQuerySchema },
  responses: {
    200: { description: 'One page of ratings', ...json(cityRatingPageSchema) },
    ...commonErrors,
  },
});

const getRatingRoute = createRoute({
  method: 'get',
  path: '/v1/cities/{cityId}/rating',
  summary: "The signed-in user's rating of a city",
  security: bearerSecurity,
  request: { params: cityParams },
  responses: {
    200: { description: 'The rating', ...json(cityRatingSchema) },
    ...commonErrors,
    404: problemResponse('The user has not rated the city'),
  },
});

const setRatingRoute = createRoute({
  method: 'put',
  path: '/v1/cities/{cityId}/rating',
  summary: 'Rate a city or change the rating (FR-RATE-001, FR-RATE-002, FR-RATE-004)',
  description:
    'Replaces the whole rating (BR-008): criteria that are left out are no longer rated.',
  security: bearerSecurity,
  request: { params: cityParams, body: { ...json(setCityRatingSchema), required: true } },
  responses: {
    200: { description: 'The rating', ...json(cityRatingSchema) },
    ...commonErrors,
    404: problemResponse('City not found'),
    409: problemResponse('The user has not visited the city (BR-005)'),
  },
});

const deleteRatingRoute = createRoute({
  method: 'delete',
  path: '/v1/cities/{cityId}/rating',
  summary: 'Delete the rating of a city (FR-RATE-004)',
  security: bearerSecurity,
  request: { params: cityParams },
  responses: {
    204: { description: 'Deleted' },
    ...commonErrors,
    404: problemResponse('The user has not rated the city'),
  },
});

const communityRatingRoute = createRoute({
  method: 'get',
  path: '/v1/cities/{cityId}/community-rating',
  summary: 'The community rating of a city (FR-CITY-003, FR-RATE-005)',
  description:
    "The mean of all users' ratings and of each criterion, with the number of ratings (BR-009). Open to guests.",
  request: { params: cityParams },
  responses: {
    200: { description: 'The community rating', ...json(communityRatingSchema) },
    400: problemResponse('Invalid request'),
    404: problemResponse('City not found'),
  },
});

/** Paths that need a signed-in user; the app puts requireAuth in front of them. */
export const ratingPaths = ['/v1/ratings', '/v1/cities/:cityId/rating'];

export function registerRatingRoutes(app: OpenAPIHono<AuthEnv>, ratings: RatingStore): void {
  app.openapi(listCriteriaRoute, async (c) => c.json({ items: await ratings.listCriteria() }, 200));

  app.openapi(communityRatingRoute, async (c) => {
    const { cityId } = c.req.valid('param');
    if (!(await ratings.cityExists(cityId))) return problem(c, 404, 'City not found') as never;
    return c.json(await ratings.communityRating(cityId), 200);
  });

  app.openapi(listRatingsRoute, async (c) => {
    const { limit, cursor } = c.req.valid('query');
    const afterCityId = idFromCursor(cursor);
    if (afterCityId === null) return invalidCursor(c) as never;

    // One row more than the page size shows whether another page exists.
    const rows = await ratings.list(c.get('user').id, { afterCityId, limit: limit + 1 });
    return c.json(
      toPage(rows, limit, (rating) => String(rating.cityId)),
      200,
    );
  });

  app.openapi(getRatingRoute, async (c) => {
    const rating = await ratings.find(c.get('user').id, c.req.valid('param').cityId);
    if (!rating) return problem(c, 404, 'City not rated') as never;
    return c.json(rating, 200);
  });

  app.openapi(setRatingRoute, async (c) => {
    const { cityId } = c.req.valid('param');
    if (!(await ratings.cityExists(cityId))) return problem(c, 404, 'City not found') as never;

    const result = await ratings.set(c.get('user').id, cityId, c.req.valid('json'));
    if ('rating' in result) return c.json(result.rating, 200);
    if (result.problem === 'not_visited') {
      return problem(
        c,
        409,
        'City not visited',
        'A city can be rated after a visit to it or when it is marked as lived-in.',
      ) as never;
    }
    return problem(
      c,
      400,
      'Invalid request',
      undefined,
      result.keys.map((key) => ({ path: `criteria.${key}`, message: 'Not a criterion' })),
    ) as never;
  });

  app.openapi(deleteRatingRoute, async (c) => {
    const removed = await ratings.remove(c.get('user').id, c.req.valid('param').cityId);
    if (!removed) return problem(c, 404, 'City not rated') as never;
    return c.body(null, 204);
  });
}
