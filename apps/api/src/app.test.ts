import { gunzipSync } from 'node:zlib';
import { healthResponseSchema, problemSchema, type CurrentUser } from '@flanr/shared';
import { describe, expect, it } from 'vitest';
import { createApp, type AppDependencies } from './app.ts';
import { noDefaultListStore } from './default-lists.ts';
import { noListStore } from './lists.ts';
import { noLivedCityStore } from './lived-cities.ts';
import { noRatingStore } from './ratings.ts';
import { noProfileStore } from './users.ts';
import { noVisitStore } from './visits.ts';

const user: CurrentUser = {
  id: 1,
  username: 'ada',
  displayName: 'Ada',
  avatarUrl: null,
  bio: null,
  homeCityId: null,
  homeCityVisible: false,
  profileVisibility: 'public' as const,
  visitedVisibility: 'public' as const,
  plannedVisibility: 'public' as const,
  roles: ['user'],
  registeredAt: '2026-03-01T12:00:00.000Z',
};

const dependencies: AppDependencies = {
  checkDatabase: async () => true,
  getCityTile: async () => null,
  corsOrigins: ['http://localhost:3000'],
  verifyToken: async (token) => (token === 'valid-token' ? 'clerk_1' : null),
  resolveUser: async () => user,
  readWebhook: async () => null,
  applyUserEvent: async () => {},
  visits: noVisitStore,
  livedCities: noLivedCityStore,
  defaultLists: noDefaultListStore,
  ratings: noRatingStore,
  lists: noListStore,
  profiles: noProfileStore,
};

describe('GET /health', () => {
  it('returns 200 when the database is reachable', async () => {
    const app = createApp({ ...dependencies, checkDatabase: async () => true });

    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toEqual({
      status: 'ok',
      database: 'ok',
    });
  });

  it('returns 503 when the database is not reachable', async () => {
    const app = createApp({ ...dependencies, checkDatabase: async () => false });

    const response = await app.request('/health');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable', database: 'unavailable' });
  });
});

describe('GET /tiles/cities/:z/:x/:y (FR-MAP-003)', () => {
  it('returns the tile as a cacheable vector tile', async () => {
    const tile = new Uint8Array([1, 2, 3]);
    const app = createApp({ ...dependencies, getCityTile: async () => tile });

    const response = await app.request('/tiles/cities/8/134/85.mvt');

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/vnd.mapbox-vector-tile');
    expect(response.headers.get('Cache-Control')).toContain('max-age=3600');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(tile);
  });

  it('compresses the tile for clients that accept gzip', async () => {
    const tile = new Uint8Array(2000).fill(7);
    const app = createApp({ ...dependencies, getCityTile: async () => tile });

    const response = await app.request('/tiles/cities/8/134/85.mvt', {
      headers: { 'Accept-Encoding': 'gzip, br' },
    });

    expect(response.headers.get('Content-Encoding')).toBe('gzip');
    expect(response.headers.get('Vary')).toContain('Accept-Encoding');
    expect(new Uint8Array(gunzipSync(new Uint8Array(await response.arrayBuffer())))).toEqual(tile);
  });

  it('passes the parsed coordinates on, with or without the file extension', async () => {
    const requested: unknown[] = [];
    const app = createApp({
      ...dependencies,
      getCityTile: async (params) => {
        requested.push(params);
        return null;
      },
    });

    await app.request('/tiles/cities/8/134/85.mvt');
    await app.request('/tiles/cities/8/134/85');

    expect(requested).toEqual([
      { z: 8, x: 134, y: 85 },
      { z: 8, x: 134, y: 85 },
    ]);
  });

  it('returns 204 for a tile without features', async () => {
    const response = await createApp(dependencies).request('/tiles/cities/8/0/0.mvt');

    expect(response.status).toBe(204);
  });

  it.each(['13/0/0', '2/4/0', '2/0/4', 'a/0/0', '2/-1/0', '2/1.5/0'])(
    'rejects invalid coordinates %s with a problem response',
    async (path) => {
      const response = await createApp(dependencies).request(`/tiles/cities/${path}.mvt`);

      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/problem+json');
      expect(await response.json()).toMatchObject({
        status: 400,
        title: 'Invalid tile coordinates',
      });
    },
  );

  it('allows browser requests from the configured web origin only', async () => {
    const app = createApp(dependencies);

    const allowed = await app.request('/health', { headers: { Origin: 'http://localhost:3000' } });
    const other = await app.request('/health', { headers: { Origin: 'https://example.com' } });

    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('GET /v1/me (SRS 6.2, NFR-SEC-003)', () => {
  it('returns the user of a valid session token', async () => {
    const response = await createApp(dependencies).request('/v1/me', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(user);
  });

  it.each([undefined, 'Bearer wrong-token', 'valid-token'])(
    'answers 401 in Problem Details format for the Authorization header %s',
    async (authorization) => {
      const response = await createApp(dependencies).request('/v1/me', {
        headers: authorization ? { Authorization: authorization } : {},
      });

      expect(response.status).toBe(401);
      expect(response.headers.get('Content-Type')).toBe('application/problem+json');
      expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
      expect(problemSchema.parse(await response.json())).toMatchObject({
        status: 401,
        title: 'Authentication required',
      });
    },
  );
});

describe('errors (RFC 9457)', () => {
  it('answers an unknown path with a 404 problem', async () => {
    const response = await createApp(dependencies).request('/v1/nothing-here');

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toBe('application/problem+json');
    expect(problemSchema.parse(await response.json())).toMatchObject({ status: 404 });
  });

  it('hides the cause of an unexpected error', async () => {
    const app = createApp({
      ...dependencies,
      resolveUser: async () => {
        throw new Error('connection refused at 10.0.0.5');
      },
    });

    const response = await app.request('/v1/me', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      type: 'about:blank',
      title: 'Internal server error',
      status: 500,
    });
  });
});

describe('GET /openapi.json (CON-009)', () => {
  it('serves an OpenAPI 3.1 document with the routes and the bearer scheme', async () => {
    const response = await createApp(dependencies).request('/openapi.json');
    const document = (await response.json()) as {
      openapi: string;
      paths: Record<string, { get: { security?: unknown } }>;
      components: { securitySchemes: Record<string, unknown> };
    };

    expect(response.status).toBe(200);
    expect(document.openapi).toBe('3.1.0');
    expect(Object.keys(document.paths)).toEqual(expect.arrayContaining(['/health', '/v1/me']));
    expect(document.paths['/v1/me']?.get.security).toEqual([{ bearerAuth: [] }]);
    expect(document.components.securitySchemes.bearerAuth).toMatchObject({ scheme: 'bearer' });
  });
});

describe('POST /webhooks/clerk (FR-AUTH-003…005)', () => {
  it('applies the user change of a signed webhook', async () => {
    const applied: unknown[] = [];
    const event = { type: 'delete', authProviderId: 'clerk_1' } as const;
    const app = createApp({
      ...dependencies,
      readWebhook: async () => event,
      applyUserEvent: async (received) => void applied.push(received),
    });

    const response = await app.request('/webhooks/clerk', { method: 'POST', body: '{}' });

    expect(response.status).toBe(204);
    expect(applied).toEqual([event]);
  });

  it('rejects a webhook whose signature does not verify', async () => {
    const applied: unknown[] = [];
    const app = createApp({
      ...dependencies,
      readWebhook: async () => {
        throw new Error('bad signature');
      },
      applyUserEvent: async (received) => void applied.push(received),
    });

    const response = await app.request('/webhooks/clerk', { method: 'POST', body: '{}' });

    expect(response.status).toBe(400);
    expect(applied).toEqual([]);
  });
});
