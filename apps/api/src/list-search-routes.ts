import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import {
  listSearchPageSchema,
  listSearchQuerySchema,
  listSearchWords,
  toPage,
} from '@flanr/shared';
import type { AuthEnv } from './auth.ts';
import type { ListStore } from './lists.ts';
import { invalidCursor, json, problemResponse } from './route-helpers.ts';

const searchListsRoute = createRoute({
  method: 'get',
  path: '/v1/public-lists',
  summary: 'Find public custom lists by their title and description (FR-SRCH-004, FR-LIST-006)',
  description:
    'Lists whose title or description contains every word of `q`, without letter case and diacritics; a word may be part of a longer word. Lists with all words in the title come first, then lists with more cities, then newer lists. Only public lists are found, also those of private profiles. Open to guests; a found list is opened through `/v1/users/{username}/lists/{listId}`.',
  request: { query: listSearchQuerySchema },
  responses: {
    200: { description: 'One page of lists', ...json(listSearchPageSchema) },
    400: problemResponse('Invalid request'),
  },
});

export function registerListSearchRoutes(app: OpenAPIHono<AuthEnv>, lists: ListStore): void {
  app.openapi(searchListsRoute, async (c) => {
    const { q, limit, cursor } = c.req.valid('query');
    // The results have no stable key to continue from, so the cursor is how many were read.
    const offset = cursor === undefined ? 0 : Number(cursor);
    if (!Number.isSafeInteger(offset) || offset < 0) return invalidCursor(c) as never;

    // One row more than the page size shows whether another page exists.
    const rows = await lists.search(listSearchWords(q), { limit: limit + 1, offset });
    return c.json(
      toPage(rows, limit, () => String(offset + limit)),
      200,
    );
  });
}
