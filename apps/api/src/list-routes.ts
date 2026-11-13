import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import {
  addListEntrySchema,
  createListSchema,
  listEntryPageSchema,
  listEntrySchema,
  listPageSchema,
  listSchema,
  paginationQuerySchema,
  toPage,
  updateListEntrySchema,
  updateListSchema,
} from '@flanr/shared';
import type { AuthEnv } from './auth.ts';
import type { ListStore } from './lists.ts';
import { problem } from './problem.ts';
import {
  bearerSecurity,
  commonErrors,
  idFromCursor,
  idParam,
  invalidCursor,
  json,
  problemResponse,
} from './route-helpers.ts';

const listParams = z.object({ listId: idParam });
const entryParams = z.object({ listId: idParam, cityId: idParam });
const listNotFound = problemResponse('The user has no such list');

const createListRoute = createRoute({
  method: 'post',
  path: '/v1/lists',
  summary: 'Create a custom list (FR-LIST-003)',
  security: bearerSecurity,
  request: { body: { ...json(createListSchema), required: true } },
  responses: {
    201: { description: 'The new list', ...json(listSchema) },
    ...commonErrors,
  },
});

const listListsRoute = createRoute({
  method: 'get',
  path: '/v1/lists',
  summary: 'The custom lists of the signed-in user, newest first',
  security: bearerSecurity,
  request: { query: paginationQuerySchema },
  responses: {
    200: { description: 'One page of lists', ...json(listPageSchema) },
    ...commonErrors,
  },
});

const getListRoute = createRoute({
  method: 'get',
  path: '/v1/lists/{listId}',
  summary: 'One custom list of the signed-in user',
  security: bearerSecurity,
  request: { params: listParams },
  responses: {
    200: { description: 'The list', ...json(listSchema) },
    ...commonErrors,
    404: listNotFound,
  },
});

const updateListRoute = createRoute({
  method: 'patch',
  path: '/v1/lists/{listId}',
  summary: 'Rename a list, change its description or its visibility (FR-LIST-003, FR-LIST-005)',
  security: bearerSecurity,
  request: { params: listParams, body: { ...json(updateListSchema), required: true } },
  responses: {
    200: { description: 'The changed list', ...json(listSchema) },
    ...commonErrors,
    404: listNotFound,
  },
});

const deleteListRoute = createRoute({
  method: 'delete',
  path: '/v1/lists/{listId}',
  summary: 'Delete a list with its entries (FR-LIST-003)',
  security: bearerSecurity,
  request: { params: listParams },
  responses: {
    204: { description: 'Deleted' },
    ...commonErrors,
    404: listNotFound,
  },
});

const listEntriesRoute = createRoute({
  method: 'get',
  path: '/v1/lists/{listId}/entries',
  summary: 'The cities of a list in its order (FR-LIST-004)',
  security: bearerSecurity,
  request: { params: listParams, query: paginationQuerySchema },
  responses: {
    200: { description: 'One page of entries', ...json(listEntryPageSchema) },
    ...commonErrors,
    404: listNotFound,
  },
});

const addEntryRoute = createRoute({
  method: 'post',
  path: '/v1/lists/{listId}/entries',
  summary: 'Add a city to the end of a list (FR-LIST-004)',
  security: bearerSecurity,
  request: { params: listParams, body: { ...json(addListEntrySchema), required: true } },
  responses: {
    201: { description: 'The new entry', ...json(listEntrySchema) },
    ...commonErrors,
    404: problemResponse('The user has no such list, or the city does not exist'),
    409: problemResponse('The city is already in the list'),
  },
});

const updateEntryRoute = createRoute({
  method: 'patch',
  path: '/v1/lists/{listId}/entries/{cityId}',
  summary: 'Change the note of an entry or move it within the list (FR-LIST-004)',
  description:
    'With `position` the entry moves to that place, counted from 1; the entries between its old and new place shift by one.',
  security: bearerSecurity,
  request: { params: entryParams, body: { ...json(updateListEntrySchema), required: true } },
  responses: {
    200: { description: 'The changed entry', ...json(listEntrySchema) },
    ...commonErrors,
    404: problemResponse('The city is not in such a list of the user'),
  },
});

const removeEntryRoute = createRoute({
  method: 'delete',
  path: '/v1/lists/{listId}/entries/{cityId}',
  summary: 'Remove a city from a list (FR-LIST-004)',
  security: bearerSecurity,
  request: { params: entryParams },
  responses: {
    204: { description: 'Removed' },
    ...commonErrors,
    404: problemResponse('The city is not in such a list of the user'),
  },
});

/** Paths that need a signed-in user; the app puts requireAuth in front of them. */
export const listPaths = ['/v1/lists', '/v1/lists/*'];

export function registerListRoutes(app: OpenAPIHono<AuthEnv>, lists: ListStore): void {
  app.openapi(createListRoute, async (c) =>
    c.json(await lists.create(c.get('user').id, c.req.valid('json')), 201),
  );

  app.openapi(listListsRoute, async (c) => {
    const { limit, cursor } = c.req.valid('query');
    const beforeId = idFromCursor(cursor);
    if (beforeId === null) return invalidCursor(c) as never;

    // One row more than the page size shows whether another page exists.
    const rows = await lists.list(c.get('user').id, { beforeId, limit: limit + 1 });
    return c.json(
      toPage(rows, limit, (list) => String(list.id)),
      200,
    );
  });

  app.openapi(getListRoute, async (c) => {
    const list = await lists.find(c.get('user').id, c.req.valid('param').listId);
    if (!list) return problem(c, 404, 'List not found') as never;
    return c.json(list, 200);
  });

  app.openapi(updateListRoute, async (c) => {
    const list = await lists.update(
      c.get('user').id,
      c.req.valid('param').listId,
      c.req.valid('json'),
    );
    if (!list) return problem(c, 404, 'List not found') as never;
    return c.json(list, 200);
  });

  app.openapi(deleteListRoute, async (c) => {
    const removed = await lists.remove(c.get('user').id, c.req.valid('param').listId);
    if (!removed) return problem(c, 404, 'List not found') as never;
    return c.body(null, 204);
  });

  app.openapi(listEntriesRoute, async (c) => {
    const { limit, cursor } = c.req.valid('query');
    const afterPosition = idFromCursor(cursor);
    if (afterPosition === null) return invalidCursor(c) as never;

    const rows = await lists.listEntries(c.get('user').id, c.req.valid('param').listId, {
      afterPosition,
      limit: limit + 1,
    });
    if (!rows) return problem(c, 404, 'List not found') as never;
    return c.json(
      toPage(rows, limit, (entry) => String(entry.position)),
      200,
    );
  });

  app.openapi(addEntryRoute, async (c) => {
    const result = await lists.addEntry(
      c.get('user').id,
      c.req.valid('param').listId,
      c.req.valid('json'),
    );
    if ('entry' in result) return c.json(result.entry, 201);
    if (result.problem === 'list_not_found') return problem(c, 404, 'List not found') as never;
    if (result.problem === 'city_not_found') return problem(c, 404, 'City not found') as never;
    return problem(c, 409, 'City already in the list') as never;
  });

  app.openapi(updateEntryRoute, async (c) => {
    const { listId, cityId } = c.req.valid('param');
    const result = await lists.updateEntry(c.get('user').id, listId, cityId, c.req.valid('json'));
    if ('entry' in result) return c.json(result.entry, 200);
    if (result.problem === 'not_found') return problem(c, 404, 'Entry not found') as never;
    return problem(c, 400, 'Invalid request', undefined, [
      { path: 'position', message: 'The list has fewer entries than that.' },
    ]) as never;
  });

  app.openapi(removeEntryRoute, async (c) => {
    const { listId, cityId } = c.req.valid('param');
    const removed = await lists.removeEntry(c.get('user').id, listId, cityId);
    if (!removed) return problem(c, 404, 'Entry not found') as never;
    return c.body(null, 204);
  });
}
