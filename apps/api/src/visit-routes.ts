import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import {
  checkVisitDate,
  createVisitSchema,
  isBeforeRegistration,
  latestToday,
  paginationQuerySchema,
  parseVisitDate,
  problemContentType,
  problemSchema,
  toPage,
  undatedVisitCountSchema,
  updateVisitSchema,
  visitDateProblemMessages,
  visitPageSchema,
  visitSchema,
  type CurrentUser,
} from '@flanr/shared';
import type { Context } from 'hono';
import type { AuthEnv } from './auth.ts';
import { problem } from './problem.ts';
import type { VisitDates, VisitStore } from './visits.ts';

const security = [{ bearerAuth: [] }];
const json = <Schema extends z.ZodType>(schema: Schema) => ({
  content: { 'application/json': { schema } },
});
const problemResponse = (description: string) => ({
  description,
  content: { [problemContentType]: { schema: problemSchema } },
});
const commonErrors = {
  400: problemResponse('Invalid request'),
  401: problemResponse('No valid session token'),
};

const id = z.coerce.number().int().positive();
const visitParams = z.object({ visitId: id });
const cityParams = z.object({ cityId: id });

const createVisitRoute = createRoute({
  method: 'post',
  path: '/v1/visits',
  summary: 'Log a visit to a city (FR-VIS-001…004)',
  security,
  request: { body: { ...json(createVisitSchema), required: true } },
  responses: {
    201: { description: 'The new visit', ...json(visitSchema) },
    ...commonErrors,
    404: problemResponse('City not found'),
  },
});

const listVisitsRoute = createRoute({
  method: 'get',
  path: '/v1/visits',
  summary: 'The visits of the signed-in user, newest first',
  security,
  request: { query: paginationQuerySchema.extend({ cityId: id.optional() }) },
  responses: {
    200: { description: 'One page of visits', ...json(visitPageSchema) },
    ...commonErrors,
  },
});

const updateVisitRoute = createRoute({
  method: 'patch',
  path: '/v1/visits/{visitId}',
  summary: 'Change the date of a visit (FR-VIS-006)',
  security,
  request: { params: visitParams, body: { ...json(updateVisitSchema), required: true } },
  responses: {
    200: { description: 'The changed visit', ...json(visitSchema) },
    ...commonErrors,
    404: problemResponse('Visit not found'),
  },
});

const deleteVisitRoute = createRoute({
  method: 'delete',
  path: '/v1/visits/{visitId}',
  summary: 'Delete a visit (FR-VIS-006)',
  security,
  request: { params: visitParams },
  responses: {
    204: { description: 'Deleted' },
    ...commonErrors,
    404: problemResponse('Visit not found'),
  },
});

const getUndatedVisitsRoute = createRoute({
  method: 'get',
  path: '/v1/cities/{cityId}/undated-visits',
  summary: 'How many undated visits the signed-in user has to a city',
  security,
  request: { params: cityParams },
  responses: {
    200: { description: 'The number of undated visits', ...json(undatedVisitCountSchema) },
    ...commonErrors,
  },
});

const setUndatedVisitsRoute = createRoute({
  method: 'put',
  path: '/v1/cities/{cityId}/undated-visits',
  summary: 'Set the number of undated visits to a city (FR-VIS-005)',
  security,
  request: {
    params: cityParams,
    body: {
      ...json(
        undatedVisitCountSchema.extend({
          /** Needed to add visits: confirms that they took place before the registration. */
          beforeRegistration: z.boolean().default(false),
        }),
      ),
      required: true,
    },
  },
  responses: {
    200: { description: 'The new number of undated visits', ...json(undatedVisitCountSchema) },
    ...commonErrors,
    404: problemResponse('City not found'),
  },
});

/** Paths that need a signed-in user; the app puts requireAuth in front of them. */
export const visitPaths = ['/v1/visits', '/v1/visits/*', '/v1/cities/:cityId/undated-visits'];

export function registerVisitRoutes(
  app: OpenAPIHono<AuthEnv>,
  visits: VisitStore,
  now: () => Date,
): void {
  const registeredOn = (user: CurrentUser) => user.registeredAt.slice(0, 10);

  /** Checks the date of a new or changed visit and turns it into what is stored. */
  function readDates(
    c: Context<AuthEnv>,
    input: { date: string | null; beforeRegistration: boolean },
    previousDate?: string | null,
  ): { dates: VisitDates } | { response: Response } {
    const date = input.date === null ? null : parseVisitDate(input.date);
    const user = c.get('user');
    const dateProblem = checkVisitDate(
      { date, beforeRegistration: input.beforeRegistration },
      {
        today: latestToday(now()),
        registeredOn: registeredOn(user),
        previousDate: previousDate ? parseVisitDate(previousDate) : null,
      },
    );
    if (dateProblem) return { response: invalidDate(c, visitDateProblemMessages[dateProblem]) };
    return {
      dates: {
        date,
        beforeRegistration: date ? isBeforeRegistration(date, registeredOn(user)) : true,
      },
    };
  }

  const invalidDate = (c: Context<AuthEnv>, message: string) =>
    problem(c, 400, 'Invalid request', undefined, [{ path: 'date', message }]);

  app.openapi(createVisitRoute, async (c) => {
    const body = c.req.valid('json');
    const read = readDates(c, body);
    if ('response' in read) return read.response as never;
    if (!(await visits.cityExists(body.cityId))) return problem(c, 404, 'City not found') as never;

    return c.json(await visits.create(c.get('user').id, body.cityId, read.dates), 201);
  });

  app.openapi(listVisitsRoute, async (c) => {
    const { limit, cursor, cityId } = c.req.valid('query');
    const beforeId = cursor === undefined ? undefined : Number(cursor);
    if (beforeId !== undefined && !Number.isSafeInteger(beforeId)) {
      return problem(c, 400, 'Invalid request', undefined, [
        { path: 'cursor', message: 'Not a cursor returned by this endpoint' },
      ]) as never;
    }

    // One row more than the page size shows whether another page exists.
    const rows = await visits.list(c.get('user').id, { cityId, beforeId, limit: limit + 1 });
    return c.json(
      toPage(rows, limit, (visit) => String(visit.id)),
      200,
    );
  });

  app.openapi(updateVisitRoute, async (c) => {
    const userId = c.get('user').id;
    const { visitId } = c.req.valid('param');
    const existing = await visits.find(userId, visitId);
    if (!existing) return problem(c, 404, 'Visit not found') as never;
    const read = readDates(c, c.req.valid('json'), existing.date);
    if ('response' in read) return read.response as never;

    const updated = await visits.update(userId, visitId, read.dates);
    if (!updated) return problem(c, 404, 'Visit not found') as never;
    return c.json(updated, 200);
  });

  app.openapi(deleteVisitRoute, async (c) => {
    const removed = await visits.remove(c.get('user').id, c.req.valid('param').visitId);
    if (!removed) return problem(c, 404, 'Visit not found') as never;
    return c.body(null, 204);
  });

  app.openapi(getUndatedVisitsRoute, async (c) => {
    const count = await visits.countUndated(c.get('user').id, c.req.valid('param').cityId);
    return c.json({ count }, 200);
  });

  app.openapi(setUndatedVisitsRoute, async (c) => {
    const userId = c.get('user').id;
    const { cityId } = c.req.valid('param');
    const { count, beforeRegistration } = c.req.valid('json');
    if (!(await visits.cityExists(cityId))) return problem(c, 404, 'City not found') as never;
    // Adding undated visits needs the same confirmation as a single one (FR-VIS-003).
    if (!beforeRegistration && count > (await visits.countUndated(userId, cityId))) {
      return invalidDate(c, visitDateProblemMessages.date_required) as never;
    }

    await visits.setUndatedCount(userId, cityId, count);
    return c.json({ count }, 200);
  });
}
