import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import {
  checkLivedPeriod,
  latestToday,
  livedCityPageSchema,
  livedCitySchema,
  livedPeriodProblems,
  paginationQuerySchema,
  parseVisitDate,
  setLivedCitySchema,
  toPage,
} from '@flanr/shared';
import type { AuthEnv } from './auth.ts';
import type { LivedCityStore } from './lived-cities.ts';
import { problem } from './problem.ts';
import {
  bearerSecurity,
  cityParams,
  commonErrors,
  json,
  problemResponse,
} from './route-helpers.ts';

const listLivedCitiesRoute = createRoute({
  method: 'get',
  path: '/v1/lived-cities',
  summary: 'The cities the signed-in user lives in or has lived in (BR-016)',
  security: bearerSecurity,
  request: { query: paginationQuerySchema },
  responses: {
    200: { description: 'One page of lived-in cities', ...json(livedCityPageSchema) },
    ...commonErrors,
  },
});

const setLivedCityRoute = createRoute({
  method: 'put',
  path: '/v1/lived-cities/{cityId}',
  summary: 'Mark a city as lived-in, or change its mark (FR-VIS-010)',
  security: bearerSecurity,
  request: { params: cityParams, body: { ...json(setLivedCitySchema), required: true } },
  responses: {
    200: { description: 'The lived-in city', ...json(livedCitySchema) },
    ...commonErrors,
    404: problemResponse('City not found'),
  },
});

const removeLivedCityRoute = createRoute({
  method: 'delete',
  path: '/v1/lived-cities/{cityId}',
  summary: 'Remove the lived-in mark from a city (FR-VIS-010)',
  security: bearerSecurity,
  request: { params: cityParams },
  responses: {
    204: { description: 'Removed' },
    ...commonErrors,
    404: problemResponse('Not a lived-in city of the user'),
  },
});

/** Paths that need a signed-in user; the app puts requireAuth in front of them. */
export const livedCityPaths = ['/v1/lived-cities', '/v1/lived-cities/*'];

export function registerLivedCityRoutes(
  app: OpenAPIHono<AuthEnv>,
  livedCities: LivedCityStore,
  now: () => Date,
): void {
  app.openapi(listLivedCitiesRoute, async (c) => {
    const { limit, cursor } = c.req.valid('query');
    const afterCityId = cursor === undefined ? undefined : Number(cursor);
    if (afterCityId !== undefined && !Number.isSafeInteger(afterCityId)) {
      return problem(c, 400, 'Invalid request', undefined, [
        { path: 'cursor', message: 'Not a cursor returned by this endpoint' },
      ]) as never;
    }

    // One row more than the page size shows whether another page exists.
    const rows = await livedCities.list(c.get('user').id, { afterCityId, limit: limit + 1 });
    return c.json(
      toPage(rows, limit, (city) => String(city.cityId)),
      200,
    );
  });

  app.openapi(setLivedCityRoute, async (c) => {
    const { cityId } = c.req.valid('param');
    const body = c.req.valid('json');
    const input = {
      isCurrent: body.isCurrent,
      from: body.from === null ? null : parseVisitDate(body.from),
      to: body.to === null ? null : parseVisitDate(body.to),
    };
    const periodProblem = checkLivedPeriod(input, latestToday(now()));
    if (periodProblem) {
      return problem(c, 400, 'Invalid request', undefined, [
        livedPeriodProblems[periodProblem],
      ]) as never;
    }
    if (!(await livedCities.cityExists(cityId))) return problem(c, 404, 'City not found') as never;

    return c.json(await livedCities.set(c.get('user').id, cityId, input), 200);
  });

  app.openapi(removeLivedCityRoute, async (c) => {
    const removed = await livedCities.remove(c.get('user').id, c.req.valid('param').cityId);
    if (!removed) return problem(c, 404, 'Not a lived-in city of the user') as never;
    return c.body(null, 204);
  });
}
