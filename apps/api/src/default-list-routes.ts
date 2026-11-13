import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import {
  paginationQuerySchema,
  plannedCityPageSchema,
  plannedCitySchema,
  toPage,
  visitedCityPageSchema,
} from '@flanr/shared';
import type { AuthEnv } from './auth.ts';
import type { DefaultListStore } from './default-lists.ts';
import { problem } from './problem.ts';
import {
  bearerSecurity,
  cityParams,
  commonErrors,
  idFromCursor,
  invalidCursor,
  json,
  problemResponse,
} from './route-helpers.ts';

const listVisitedRoute = createRoute({
  method: 'get',
  path: '/v1/visited-cities',
  summary: 'The Visited list of the signed-in user (FR-LIST-001)',
  description: 'Cities the user has a visit to or has marked as lived-in (BR-004).',
  security: bearerSecurity,
  request: { query: paginationQuerySchema },
  responses: {
    200: { description: 'One page of visited cities', ...json(visitedCityPageSchema) },
    ...commonErrors,
  },
});

const listPlannedRoute = createRoute({
  method: 'get',
  path: '/v1/planned-cities',
  summary: 'The Planned list of the signed-in user (FR-LIST-002)',
  security: bearerSecurity,
  request: { query: paginationQuerySchema },
  responses: {
    200: { description: 'One page of planned cities', ...json(plannedCityPageSchema) },
    ...commonErrors,
  },
});

const planCityRoute = createRoute({
  method: 'put',
  path: '/v1/planned-cities/{cityId}',
  summary: 'Add a city to the Planned list (FR-LIST-002)',
  security: bearerSecurity,
  request: { params: cityParams },
  responses: {
    200: { description: 'The planned city', ...json(plannedCitySchema) },
    ...commonErrors,
    404: problemResponse('City not found'),
    409: problemResponse('The city is already visited (BR-004)'),
  },
});

const unplanCityRoute = createRoute({
  method: 'delete',
  path: '/v1/planned-cities/{cityId}',
  summary: 'Remove a city from the Planned list (FR-LIST-002)',
  security: bearerSecurity,
  request: { params: cityParams },
  responses: {
    204: { description: 'Removed' },
    ...commonErrors,
    404: problemResponse('Not in the Planned list of the user'),
  },
});

/** Paths that need a signed-in user; the app puts requireAuth in front of them. */
export const defaultListPaths = [
  '/v1/visited-cities',
  '/v1/planned-cities',
  '/v1/planned-cities/*',
];

export function registerDefaultListRoutes(
  app: OpenAPIHono<AuthEnv>,
  lists: DefaultListStore,
): void {
  app.openapi(listVisitedRoute, async (c) => {
    const { limit, cursor } = c.req.valid('query');
    const afterCityId = idFromCursor(cursor);
    if (afterCityId === null) return invalidCursor(c) as never;

    // One row more than the page size shows whether another page exists.
    const rows = await lists.listVisited(c.get('user').id, { afterCityId, limit: limit + 1 });
    return c.json(
      toPage(rows, limit, (city) => String(city.cityId)),
      200,
    );
  });

  app.openapi(listPlannedRoute, async (c) => {
    const { limit, cursor } = c.req.valid('query');
    const afterCityId = idFromCursor(cursor);
    if (afterCityId === null) return invalidCursor(c) as never;

    const rows = await lists.listPlanned(c.get('user').id, { afterCityId, limit: limit + 1 });
    return c.json(
      toPage(rows, limit, (city) => String(city.cityId)),
      200,
    );
  });

  app.openapi(planCityRoute, async (c) => {
    const { cityId } = c.req.valid('param');
    if (!(await lists.cityExists(cityId))) return problem(c, 404, 'City not found') as never;

    const planned = await lists.plan(c.get('user').id, cityId);
    if (!planned) {
      return problem(
        c,
        409,
        'City already visited',
        'A visited city cannot be added to the Planned list.',
      ) as never;
    }
    return c.json(planned, 200);
  });

  app.openapi(unplanCityRoute, async (c) => {
    const removed = await lists.unplan(c.get('user').id, c.req.valid('param').cityId);
    if (!removed) return problem(c, 404, 'Not in the Planned list of the user') as never;
    return c.body(null, 204);
  });
}
