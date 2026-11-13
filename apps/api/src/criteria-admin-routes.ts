import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import {
  createCriterionSchema,
  criterionKeySchema,
  managedCriterionListSchema,
  managedCriterionSchema,
  updateCriterionSchema,
} from '@flanr/shared';
import type { AuthEnv } from './auth.ts';
import { problem } from './problem.ts';
import type { RatingStore } from './ratings.ts';
import { bearerSecurity, commonErrors, json, problemResponse } from './route-helpers.ts';

const adminErrors = {
  ...commonErrors,
  403: problemResponse('The user is not an administrator'),
};

const listAllCriteriaRoute = createRoute({
  method: 'get',
  path: '/v1/admin/criteria',
  summary: 'All rating criteria, also those that are switched off (FR-RATE-006)',
  security: bearerSecurity,
  responses: {
    200: { description: 'The criteria in display order', ...json(managedCriterionListSchema) },
    ...adminErrors,
  },
});

const createCriterionRoute = createRoute({
  method: 'post',
  path: '/v1/admin/criteria',
  summary: 'Add a rating criterion (FR-RATE-006)',
  security: bearerSecurity,
  request: { body: { ...json(createCriterionSchema), required: true } },
  responses: {
    201: { description: 'The new criterion', ...json(managedCriterionSchema) },
    ...adminErrors,
    409: problemResponse('A criterion with this key exists'),
  },
});

const updateCriterionRoute = createRoute({
  method: 'patch',
  path: '/v1/admin/criteria/{key}',
  summary: 'Rename, reorder, switch off or switch on a criterion (FR-RATE-006)',
  description:
    'A criterion is removed by switching it off. Its ratings stay stored and count again when it is switched on.',
  security: bearerSecurity,
  request: {
    params: z.object({ key: criterionKeySchema }),
    body: { ...json(updateCriterionSchema), required: true },
  },
  responses: {
    200: { description: 'The changed criterion', ...json(managedCriterionSchema) },
    ...adminErrors,
    404: problemResponse('Criterion not found'),
  },
});

/** Paths for administrators only; the app puts requireAuth and requireRole in front of them. */
export const criteriaAdminPaths = ['/v1/admin/criteria', '/v1/admin/criteria/*'];

export function registerCriteriaAdminRoutes(app: OpenAPIHono<AuthEnv>, ratings: RatingStore): void {
  app.openapi(listAllCriteriaRoute, async (c) =>
    c.json({ items: await ratings.listAllCriteria() }, 200),
  );

  app.openapi(createCriterionRoute, async (c) => {
    const criterion = await ratings.createCriterion(c.req.valid('json'));
    if (!criterion) return problem(c, 409, 'Criterion key is taken') as never;
    return c.json(criterion, 201);
  });

  app.openapi(updateCriterionRoute, async (c) => {
    const criterion = await ratings.updateCriterion(c.req.valid('param').key, c.req.valid('json'));
    if (!criterion) return problem(c, 404, 'Criterion not found') as never;
    return c.json(criterion, 200);
  });
}
