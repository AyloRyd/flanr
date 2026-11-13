import { gzipSync } from 'node:zlib';
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import {
  currentUserSchema,
  healthResponseSchema,
  problemContentType,
  problemSchema,
  type HealthResponse,
} from '@flanr/shared';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { requireAuth, type AuthEnv, type TokenVerifier, type UserResolver } from './auth.ts';
import { tileParamsSchema, type TileParams } from './city-tiles.ts';
import type { UserEvent, WebhookReader } from './clerk.ts';
import { defaultListPaths, registerDefaultListRoutes } from './default-list-routes.ts';
import type { DefaultListStore } from './default-lists.ts';
import { livedCityPaths, registerLivedCityRoutes } from './lived-city-routes.ts';
import type { LivedCityStore } from './lived-cities.ts';
import { problem } from './problem.ts';
import { rateLimitWrites, type RateLimitOptions } from './rate-limit.ts';
import { registerVisitRoutes, visitPaths } from './visit-routes.ts';
import type { VisitStore } from './visits.ts';

export interface AppDependencies {
  checkDatabase: () => Promise<boolean>;
  getCityTile: (params: TileParams) => Promise<Uint8Array | null>;
  /** Origins of web clients that may call the API from the browser. */
  corsOrigins: string[];
  verifyToken: TokenVerifier;
  resolveUser: UserResolver;
  readWebhook: WebhookReader;
  applyUserEvent: (event: UserEvent) => Promise<void>;
  visits: VisitStore;
  livedCities: LivedCityStore;
  defaultLists: DefaultListStore;
  /** The current time; replaced in tests. */
  now?: () => Date;
  writeRateLimit?: RateLimitOptions;
}

const problemResponse = (description: string) => ({
  description,
  content: { [problemContentType]: { schema: problemSchema } },
});

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  summary: 'Whether the API and its database are available',
  responses: {
    200: {
      description: 'Available',
      content: { 'application/json': { schema: healthResponseSchema } },
    },
    503: {
      description: 'Not available',
      content: { 'application/json': { schema: healthResponseSchema } },
    },
  },
});

const meRoute = createRoute({
  method: 'get',
  path: '/v1/me',
  summary: 'The signed-in user',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'The signed-in user',
      content: { 'application/json': { schema: currentUserSchema } },
    },
    401: problemResponse('No valid session token'),
  },
});

const defaultWriteRateLimit: RateLimitOptions = { limit: 60, windowMs: 60_000 };

// City data changes with the monthly import, so tiles can be cached for a while.
const tileCacheControl = 'public, max-age=3600, stale-while-revalidate=86400';

export function createApp({
  checkDatabase,
  getCityTile,
  corsOrigins,
  verifyToken,
  resolveUser,
  readWebhook,
  applyUserEvent,
  visits,
  livedCities,
  defaultLists,
  now = () => new Date(),
  writeRateLimit = defaultWriteRateLimit,
}: AppDependencies) {
  const app = new OpenAPIHono<AuthEnv>({
    // Requests that do not match a route's schemas are answered in Problem Details format.
    defaultHook: (result, c) => {
      if (result.success) return;
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return problem(c, 400, 'Invalid request', undefined, errors);
    },
  });

  app.notFound((c) => problem(c, 404, 'Not found'));
  app.onError((error, c) => {
    if (error instanceof HTTPException) return problem(c, error.status, error.message);
    console.error(error);
    return problem(c, 500, 'Internal server error');
  });

  app.use(cors({ origin: corsOrigins }));
  // Everything under /v1 that reads or changes user data needs a signed-in user (NFR-SEC-003).
  for (const path of ['/v1/me', ...visitPaths, ...livedCityPaths, ...defaultListPaths]) {
    app.use(path, requireAuth(verifyToken, resolveUser));
  }
  app.use('/v1/*', rateLimitWrites(writeRateLimit));

  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description: 'Clerk session token',
  });
  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Flanr API', version: '0.1.0' },
  });

  app.openapi(healthRoute, async (c) => {
    const databaseOk = await checkDatabase();
    const body: HealthResponse = {
      status: databaseOk ? 'ok' : 'unavailable',
      database: databaseOk ? 'ok' : 'unavailable',
    };
    return c.json(body, databaseOk ? 200 : 503);
  });

  app.openapi(meRoute, (c) => c.json(c.get('user'), 200));

  registerVisitRoutes(app, visits, now);
  registerLivedCityRoutes(app, livedCities, now);
  registerDefaultListRoutes(app, defaultLists);

  // Clerk reports created, changed and deleted accounts here (FR-AUTH-003…005, FR-AUTH-009).
  app.post('/webhooks/clerk', async (c) => {
    let event: UserEvent | null;
    try {
      event = await readWebhook(c.req.raw);
    } catch {
      return problem(c, 400, 'Invalid webhook signature');
    }
    if (event) await applyUserEvent(event);
    return c.body(null, 204);
  });

  app.get('/tiles/cities/:z/:x/:y', async (c) => {
    const params = tileParamsSchema.safeParse({
      z: c.req.param('z'),
      x: c.req.param('x'),
      // The file extension is optional: /tiles/cities/8/134/85.mvt
      y: c.req.param('y').replace(/\.mvt$/, ''),
    });
    if (!params.success) {
      return problem(c, 400, 'Invalid tile coordinates', params.error.issues[0]?.message);
    }

    const tile = await getCityTile(params.data);
    c.header('Cache-Control', tileCacheControl);
    if (!tile) {
      return c.body(null, 204);
    }
    c.header('Content-Type', 'application/vnd.mapbox-vector-tile');
    c.header('Vary', 'Accept-Encoding');
    // Vector tiles are protobuf and shrink to about half their size with gzip.
    if (c.req.header('Accept-Encoding')?.includes('gzip')) {
      c.header('Content-Encoding', 'gzip');
      return c.body(new Uint8Array(gzipSync(tile)));
    }
    return c.body(new Uint8Array(tile));
  });

  return app;
}
