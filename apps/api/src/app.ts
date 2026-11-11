import { Hono } from 'hono';
import { gzipSync } from 'node:zlib';
import { cors } from 'hono/cors';
import type { HealthResponse } from '@flanr/shared';
import { tileParamsSchema, type TileParams } from './city-tiles.ts';
import { problem } from './problem.ts';

export interface AppDependencies {
  checkDatabase: () => Promise<boolean>;
  getCityTile: (params: TileParams) => Promise<Uint8Array | null>;
  /** Origins of web clients that may call the API from the browser. */
  corsOrigins: string[];
}

// City data changes with the monthly import, so tiles can be cached for a while.
const tileCacheControl = 'public, max-age=3600, stale-while-revalidate=86400';

export function createApp({ checkDatabase, getCityTile, corsOrigins }: AppDependencies) {
  const app = new Hono();

  app.use(cors({ origin: corsOrigins }));

  app.get('/health', async (c) => {
    const databaseOk = await checkDatabase();
    const body: HealthResponse = {
      status: databaseOk ? 'ok' : 'unavailable',
      database: databaseOk ? 'ok' : 'unavailable',
    };
    return c.json(body, databaseOk ? 200 : 503);
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
