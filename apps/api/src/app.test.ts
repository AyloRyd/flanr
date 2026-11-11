import { gunzipSync } from 'node:zlib';
import { healthResponseSchema } from '@flanr/shared';
import { describe, expect, it } from 'vitest';
import { createApp, type AppDependencies } from './app.ts';

const dependencies: AppDependencies = {
  checkDatabase: async () => true,
  getCityTile: async () => null,
  corsOrigins: ['http://localhost:3000'],
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
