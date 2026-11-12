import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { chromium } from '@playwright/test';
import { FetchSource, PMTiles } from 'pmtiles';

// Measures the three ways to deliver the city layer. Needs the API and the stand server running:
//   pnpm --filter @flanr/api dev    and    pnpm --filter @flanr/tile-bench serve
// Prints the results as JSON.

const apiUrl = process.env.BENCH_API_URL ?? 'http://localhost:8787';
const standUrl = process.env.BENCH_STAND_URL ?? 'http://localhost:4173';
const repoRoot = resolve(import.meta.dirname, '../../..');
const pointsFile = resolve(repoRoot, 'data/work/tiles/city-points.ndjson');

const zooms = [4, 6, 8, 10, 12];
const tilesPerZoom = 60;
const repeats = 3;
const browserRuns = 3;
const views = [
  { name: 'Europe, zoom 4', query: 'lng=10&lat=50&zoom=4' },
  { name: 'Germany, zoom 5.5', query: 'lng=10.4&lat=51.2&zoom=5.5' },
  { name: 'Cologne, zoom 11', query: 'lng=6.96&lat=50.94&zoom=11' },
];
const browserSources = ['mvt', 'pmtiles', 'geojson'] as const;
const firstRenderTimeoutMs = 180_000;

interface Tile {
  z: number;
  x: number;
  y: number;
}

/** Small seeded generator, so every run measures the same tiles. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

function tileAt(lon: number, lat: number, z: number): Tile {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  return {
    z,
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n),
  };
}

/** Tiles are sampled where the cities are, so empty tiles do not flatter the numbers. */
async function sampleTiles(): Promise<Map<number, Tile[]>> {
  const coordinates: [number, number][] = [];
  for await (const line of createInterface({ input: createReadStream(pointsFile, 'utf8') })) {
    if (line) coordinates.push(JSON.parse(line).geometry.coordinates);
  }
  const random = seededRandom(42);
  const sample = new Map<number, Tile[]>();
  for (const z of zooms) {
    const tiles = new Map<string, Tile>();
    for (let tries = 0; tiles.size < tilesPerZoom && tries < tilesPerZoom * 50; tries++) {
      const [lon, lat] = coordinates[Math.floor(random() * coordinates.length)] ?? [0, 0];
      const tile = tileAt(lon, lat, z);
      tiles.set(`${tile.x}/${tile.y}`, tile);
    }
    sample.set(z, [...tiles.values()]);
  }
  return sample;
}

function summary(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (share: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0;
  const round = (value: number) => Math.round(value * 10) / 10;
  return { median: round(at(0.5)), p95: round(at(0.95)) };
}

async function timed<T>(action: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const start = performance.now();
  const value = await action();
  return { ms: performance.now() - start, value };
}

/** Time to get one tile, and its uncompressed size, for the API endpoint and the PMTiles archive. */
async function measureTiles(sample: Map<number, Tile[]>) {
  const archive = new PMTiles(new FetchSource(`${standUrl}/data/cities.pmtiles`));
  const fetchers = {
    mvt: async ({ z, x, y }: Tile) => {
      const response = await fetch(`${apiUrl}/tiles/cities/${z}/${x}/${y}.mvt`);
      return (await response.arrayBuffer()).byteLength;
    },
    pmtiles: async ({ z, x, y }: Tile) => (await archive.getZxy(z, x, y))?.data.byteLength ?? 0,
  };

  const results = [];
  for (const [z, tiles] of sample) {
    for (const [name, fetchTile] of Object.entries(fetchers)) {
      for (const tile of tiles) await fetchTile(tile); // warm-up
      const times: number[] = [];
      const sizes: number[] = [];
      for (let repeat = 0; repeat < repeats; repeat++) {
        for (const tile of tiles) {
          const { ms, value } = await timed(() => fetchTile(tile));
          times.push(ms);
          if (repeat === 0) sizes.push(value);
        }
      }
      results.push({
        zoom: z,
        source: name,
        tiles: tiles.length,
        ms: summary(times),
        kilobytes: summary(sizes.map((bytes) => bytes / 1024)),
      });
    }
  }
  return results;
}

/** Time until the map has drawn everything for a view, and the bytes it downloaded for the layer. */
async function measureBrowser() {
  const browser = await chromium.launch();
  const results = [];
  for (const view of views) {
    for (const source of browserSources) {
      const renderTimes: number[] = [];
      const transferred: number[] = [];
      let finished = true;
      for (let run = 0; run < browserRuns && finished; run++) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        const page = await context.newPage();
        // Counted on the context, because MapLibre loads tiles and GeoJSON from a web worker.
        let bytes = 0;
        const counted: Promise<void>[] = [];
        context.on('requestfinished', (request) => {
          const url = request.url();
          if (!url.includes('/tiles/cities/') && !url.includes('/data/')) return;
          counted.push(
            request.sizes().then((sizes) => {
              bytes += sizes.responseBodySize;
            }),
          );
        });

        await page.goto(`${standUrl}/?source=${source}&${view.query}`);
        try {
          await page.waitForFunction(() => window.__bench?.firstIdleMs != null, null, {
            timeout: firstRenderTimeoutMs,
          });
          renderTimes.push(await page.evaluate(() => window.__bench.firstIdleMs as number));
          await Promise.all(counted);
          transferred.push(bytes);
        } catch {
          finished = false;
        }
        await context.close();
      }
      results.push({
        view: view.name,
        source,
        finished,
        firstRenderMs: finished ? summary(renderTimes).median : null,
        transferredKilobytes: finished ? Math.round(summary(transferred).median / 1024) : null,
      });
    }
  }
  await browser.close();
  return results;
}

async function fileSizes() {
  const megabytes = async (path: string) =>
    Math.round(((await stat(resolve(repoRoot, path))).size / 1024 / 1024) * 10) / 10;
  return {
    pmtilesMegabytes: await megabytes('data/tiles/cities.pmtiles'),
    geojsonPointsMegabytes: await megabytes('data/work/tiles/city-points.ndjson'),
    geojsonBoundariesMegabytes: await megabytes('data/work/tiles/city-boundaries.ndjson'),
  };
}

declare global {
  interface Window {
    __bench: { source: string; firstIdleMs: number | null };
  }
}

// BENCH_ONLY=browser skips the per-tile timings.
const tiles = process.env.BENCH_ONLY === 'browser' ? [] : await measureTiles(await sampleTiles());
console.log(
  JSON.stringify(
    {
      tiles,
      browser: await measureBrowser(),
      files: await fileSizes(),
    },
    null,
    2,
  ),
);
