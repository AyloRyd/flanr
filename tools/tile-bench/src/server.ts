import { createReadStream } from 'node:fs';
import { open, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { serve } from '@hono/node-server';
import { cityTileLayers, cityTileMaxZoom } from '@flanr/shared';
import { Hono } from 'hono';

// Serves the map stand and the static data files. The MVT tiles come from the API itself.

const port = Number(process.env.BENCH_PORT ?? 4173);
const apiUrl = process.env.BENCH_API_URL ?? 'http://localhost:8787';
const repoRoot = resolve(import.meta.dirname, '../../..');
const publicDir = resolve(import.meta.dirname, '../public');
const require = createRequire(import.meta.url);
const maplibreDir = dirname(require.resolve('maplibre-gl/dist/maplibre-gl.css'));
const pmtilesScript = resolve(dirname(require.resolve('pmtiles/package.json')), 'dist/pmtiles.js');

const files = {
  pmtiles: resolve(repoRoot, 'data/tiles/cities.pmtiles'),
  points: resolve(repoRoot, 'data/work/tiles/city-points.ndjson'),
  boundaries: resolve(repoRoot, 'data/work/tiles/city-boundaries.ndjson'),
};

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
};

const app = new Hono();

app.get('/config.json', (c) =>
  c.json({
    apiUrl,
    layers: cityTileLayers,
    maxZoom: cityTileMaxZoom,
    attribution: '© OpenStreetMap contributors',
  }),
);

app.get('/', () => sendFile(resolve(publicDir, 'index.html')));
app.get('/stand.js', () => sendFile(resolve(publicDir, 'stand.js')));
app.get('/vendor/pmtiles.js', () => sendFile(pmtilesScript));
app.get('/vendor/maplibre-gl/:file', (c) => sendFile(resolve(maplibreDir, c.req.param('file'))));

// PMTiles are read with HTTP range requests, the way a CDN or object storage serves them.
app.get('/data/cities.pmtiles', async (c) => {
  const { size } = await stat(files.pmtiles);
  const range = c.req.header('Range')?.match(/^bytes=(\d+)-(\d*)$/);
  if (!range) {
    return c.body(null, 416, { 'Content-Range': `bytes */${size}` });
  }
  const start = Number(range[1]);
  const end = Math.min(range[2] ? Number(range[2]) : size - 1, size - 1);
  const buffer = Buffer.alloc(end - start + 1);
  const handle = await open(files.pmtiles, 'r');
  try {
    await handle.read(buffer, 0, buffer.length, start);
  } finally {
    await handle.close();
  }
  return c.body(buffer, 206, {
    'Content-Type': 'application/octet-stream',
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Accept-Ranges': 'bytes',
  });
});

// The baseline: the whole layer as one GeoJSON document.
app.get('/data/city-points.geojson', () => featureCollection(files.points));
app.get('/data/city-boundaries.geojson', () => featureCollection(files.boundaries));

async function sendFile(path: string): Promise<Response> {
  return new Response(await readFile(path), {
    headers: { 'Content-Type': contentTypes[extname(path)] ?? 'application/octet-stream' },
  });
}

/** Wraps newline-delimited features into a FeatureCollection without loading the file into memory. */
function featureCollection(ndjsonPath: string): Response {
  async function* parts() {
    yield '{"type":"FeatureCollection","features":[';
    let rest = '';
    let first = true;
    for await (const chunk of createReadStream(ndjsonPath, 'utf8')) {
      const lines = (rest + chunk).split('\n');
      rest = lines.pop() ?? '';
      for (const line of lines) {
        if (!line) continue;
        yield first ? line : `,${line}`;
        first = false;
      }
    }
    if (rest) yield first ? rest : `,${rest}`;
    yield ']}';
  }
  return new Response(Readable.toWeb(Readable.from(parts())) as ReadableStream, {
    headers: { 'Content-Type': 'application/geo+json' },
  });
}

serve({ fetch: app.fetch, port }, () => {
  console.log(`Tile stand on http://localhost:${port} (API: ${apiUrl})`);
});
