import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import {
  cityRatingPageSchema,
  listEntryPageSchema,
  listPageSchema,
  listSchema,
  paginationQuerySchema,
  plannedCityPageSchema,
  visitedCityPageSchema,
  toPage,
  userMapSchema,
} from '@flanr/shared';
import type { Context } from 'hono';
import type { AuthEnv } from './auth.ts';
import type { DefaultListStore } from './default-lists.ts';
import type { ListStore } from './lists.ts';
import { problem } from './problem.ts';
import type { RatingStore } from './ratings.ts';
import { idFromCursor, idParam, invalidCursor, json, problemResponse } from './route-helpers.ts';
import type { ContentOwner, ProfileStore } from './users.ts';

const userParams = z.object({ username: z.string().min(1).max(100) });
const userListParams = userParams.extend({ listId: idParam });

/** Responses of every route that shows the content of another user. */
const contentErrors = {
  400: problemResponse('Invalid request'),
  403: problemResponse('The profile is private (FR-PRIV-001)'),
  404: problemResponse('No user has this username'),
};

/** Responses of the routes for custom lists, which a private profile still shows (FR-PRIV-001). */
const customListErrors = {
  400: problemResponse('Invalid request'),
  404: problemResponse('No user has this username'),
};

const visitedRoute = createRoute({
  method: 'get',
  path: '/v1/users/{username}/visited-cities',
  summary: 'The Visited list of a user with a public profile (FR-PROF-004, FR-LIST-005)',
  request: { params: userParams, query: paginationQuerySchema },
  responses: {
    200: { description: 'One page of visited cities', ...json(visitedCityPageSchema) },
    ...contentErrors,
  },
});

const plannedRoute = createRoute({
  method: 'get',
  path: '/v1/users/{username}/planned-cities',
  summary: 'The Planned list of a user with a public profile (FR-PROF-004, FR-LIST-005)',
  request: { params: userParams, query: paginationQuerySchema },
  responses: {
    200: { description: 'One page of planned cities', ...json(plannedCityPageSchema) },
    ...contentErrors,
  },
});

const mapRoute = createRoute({
  method: 'get',
  path: '/v1/users/{username}/map-cities',
  summary: 'The cities of the map of a user with a public profile (FR-MAP-007)',
  description:
    'The Visited and the Planned list at once, with what the map modes need of every city. Not paginated.',
  request: { params: userParams },
  responses: {
    200: { description: 'The cities of the map', ...json(userMapSchema) },
    ...contentErrors,
  },
});

const ratingsRoute = createRoute({
  method: 'get',
  path: '/v1/users/{username}/ratings',
  summary:
    'The city ratings of a user with a public profile, part of the Visited list (FR-PROF-004)',
  request: { params: userParams, query: paginationQuerySchema },
  responses: {
    200: { description: 'One page of ratings', ...json(cityRatingPageSchema) },
    ...contentErrors,
  },
});

const listsRoute = createRoute({
  method: 'get',
  path: '/v1/users/{username}/lists',
  summary: 'The public custom lists of a user, newest first (FR-LIST-006)',
  description: 'Also of a private profile (FR-PRIV-001).',
  request: { params: userParams, query: paginationQuerySchema },
  responses: {
    200: { description: 'One page of lists', ...json(listPageSchema) },
    ...customListErrors,
  },
});

const listRoute = createRoute({
  method: 'get',
  path: '/v1/users/{username}/lists/{listId}',
  summary: 'One public custom list of a user',
  request: { params: userListParams },
  responses: {
    200: { description: 'The list', ...json(listSchema) },
    ...customListErrors,
    404: problemResponse('No such user, or the user has no such public list'),
  },
});

const listEntriesRoute = createRoute({
  method: 'get',
  path: '/v1/users/{username}/lists/{listId}/entries',
  summary: 'The cities of a public custom list in its order',
  request: { params: userListParams, query: paginationQuerySchema },
  responses: {
    200: { description: 'One page of entries', ...json(listEntryPageSchema) },
    ...customListErrors,
    404: problemResponse('No such user, or the user has no such public list'),
  },
});

export interface UserContentStores {
  profiles: ProfileStore;
  defaultLists: DefaultListStore;
  ratings: RatingStore;
  lists: ListStore;
}

/**
 * What everyone, guests included, can see of a user's content. Of a private profile only the
 * public custom lists are shown (FR-PRIV-001, FR-PRIV-003), and of a public one everything but
 * the private custom lists (FR-LIST-005). The owner reads their own content through the routes
 * for the signed-in user.
 */
export function registerUserContentRoutes(
  app: OpenAPIHono<AuthEnv>,
  { profiles, defaultLists, ratings, lists }: UserContentStores,
): void {
  /** Finds the user of the path, or answers why their content cannot be shown. */
  async function publicOwner(
    c: Context,
    username: string,
  ): Promise<{ owner: ContentOwner } | { response: Response }> {
    const owner = await profiles.findContentOwner(username);
    if (!owner) return { response: problem(c, 404, 'User not found') };
    if (owner.profileVisibility === 'private') {
      return { response: problem(c, 403, 'Profile is private') };
    }
    return { owner };
  }

  /** Finds the user of the path, whatever the visibility of the profile. */
  async function listOwner(
    c: Context,
    username: string,
  ): Promise<{ owner: ContentOwner } | { response: Response }> {
    const owner = await profiles.findContentOwner(username);
    return owner ? { owner } : { response: problem(c, 404, 'User not found') };
  }

  app.openapi(visitedRoute, async (c) => {
    const found = await publicOwner(c, c.req.valid('param').username);
    if ('response' in found) return found.response as never;
    const { limit, cursor } = c.req.valid('query');
    const afterCityId = idFromCursor(cursor);
    if (afterCityId === null) return invalidCursor(c) as never;

    // One row more than the page size shows whether another page exists.
    const rows = await defaultLists.listVisited(found.owner.id, { afterCityId, limit: limit + 1 });
    return c.json(
      toPage(rows, limit, (city) => String(city.cityId)),
      200,
    );
  });

  app.openapi(plannedRoute, async (c) => {
    const found = await publicOwner(c, c.req.valid('param').username);
    if ('response' in found) return found.response as never;
    const { limit, cursor } = c.req.valid('query');
    const afterCityId = idFromCursor(cursor);
    if (afterCityId === null) return invalidCursor(c) as never;

    const rows = await defaultLists.listPlanned(found.owner.id, { afterCityId, limit: limit + 1 });
    return c.json(
      toPage(rows, limit, (city) => String(city.cityId)),
      200,
    );
  });

  // The map shows the Visited and the Planned list, so it is as visible as they are.
  app.openapi(mapRoute, async (c) => {
    const found = await publicOwner(c, c.req.valid('param').username);
    if ('response' in found) return found.response as never;
    return c.json(await defaultLists.map(found.owner.id), 200);
  });

  app.openapi(ratingsRoute, async (c) => {
    const found = await publicOwner(c, c.req.valid('param').username);
    if ('response' in found) return found.response as never;
    const { limit, cursor } = c.req.valid('query');
    const afterCityId = idFromCursor(cursor);
    if (afterCityId === null) return invalidCursor(c) as never;

    const rows = await ratings.list(found.owner.id, { afterCityId, limit: limit + 1 });
    return c.json(
      toPage(rows, limit, (rating) => String(rating.cityId)),
      200,
    );
  });

  app.openapi(listsRoute, async (c) => {
    const found = await listOwner(c, c.req.valid('param').username);
    if ('response' in found) return found.response as never;
    const { limit, cursor } = c.req.valid('query');
    const beforeId = idFromCursor(cursor);
    if (beforeId === null) return invalidCursor(c) as never;

    const rows = await lists.list(found.owner.id, {
      beforeId,
      limit: limit + 1,
      audience: 'others',
    });
    return c.json(
      toPage(rows, limit, (list) => String(list.id)),
      200,
    );
  });

  app.openapi(listRoute, async (c) => {
    const { username, listId } = c.req.valid('param');
    const found = await listOwner(c, username);
    if ('response' in found) return found.response as never;

    const list = await lists.find(found.owner.id, listId, 'others');
    if (!list) return problem(c, 404, 'List not found') as never;
    return c.json(list, 200);
  });

  app.openapi(listEntriesRoute, async (c) => {
    const { username, listId } = c.req.valid('param');
    const found = await listOwner(c, username);
    if ('response' in found) return found.response as never;
    const { limit, cursor } = c.req.valid('query');
    const afterPosition = idFromCursor(cursor);
    if (afterPosition === null) return invalidCursor(c) as never;

    const rows = await lists.listEntries(found.owner.id, listId, {
      afterPosition,
      limit: limit + 1,
      audience: 'others',
    });
    if (!rows) return problem(c, 404, 'List not found') as never;
    return c.json(
      toPage(rows, limit, (entry) => String(entry.position)),
      200,
    );
  });
}
