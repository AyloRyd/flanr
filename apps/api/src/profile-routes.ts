import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { currentUserSchema, publicProfileSchema, updateProfileSchema } from '@flanr/shared';
import type { AuthEnv } from './auth.ts';
import { problem } from './problem.ts';
import { bearerSecurity, commonErrors, json, problemResponse } from './route-helpers.ts';
import type { ProfileStore } from './users.ts';

const updateProfileRoute = createRoute({
  method: 'patch',
  path: '/v1/me',
  summary: 'Change the profile and the settings of the signed-in user (FR-PROF-001…003)',
  description:
    'Only the given fields change. The avatar is the picture of the account at the authentication provider and is changed there.',
  security: bearerSecurity,
  request: { body: { ...json(updateProfileSchema), required: true } },
  responses: {
    200: { description: 'The signed-in user', ...json(currentUserSchema) },
    ...commonErrors,
    409: problemResponse('The username is taken'),
  },
});

const publicProfileRoute = createRoute({
  method: 'get',
  path: '/v1/users/{username}',
  summary: 'The profile of a user as everyone sees it (FR-PROF-004)',
  description:
    'Open to guests. The username is matched without letter case. Of a private profile only the username and the display name are returned (FR-PRIV-001).',
  request: { params: z.object({ username: z.string().min(1).max(100) }) },
  responses: {
    200: { description: 'The profile', ...json(publicProfileSchema) },
    400: problemResponse('Invalid request'),
    404: problemResponse('No user has this username'),
  },
});

export function registerProfileRoutes(app: OpenAPIHono<AuthEnv>, profiles: ProfileStore): void {
  app.openapi(updateProfileRoute, async (c) => {
    const user = await profiles.update(c.get('user').id, c.req.valid('json'));
    if (user === 'username_taken') {
      return problem(c, 409, 'Username taken', 'Another user has this username.') as never;
    }
    return c.json(user, 200);
  });

  app.openapi(publicProfileRoute, async (c) => {
    const profile = await profiles.findPublic(c.req.valid('param').username);
    if (!profile) return problem(c, 404, 'User not found') as never;
    return c.json(profile, 200);
  });
}
