import { mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cityTileLayers, cityTileMaxZoom } from '@flanr/shared';
import postgres from 'postgres';
import { pathInDataDir, runTool } from '../docker.ts';
import { exportCityFeatures } from './export.ts';

// Builds data/tiles/cities.pmtiles from the cities in the database: pnpm tiles:build

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const repoRoot = resolve(import.meta.dirname, '../../../..');
const workDir = resolve(repoRoot, 'data/work/tiles');
const outDir = resolve(repoRoot, 'data/tiles');
const files = {
  points: resolve(workDir, 'city-points.ndjson'),
  boundaries: resolve(workDir, 'city-boundaries.ndjson'),
};
const output = resolve(outDir, 'cities.pmtiles');
const inContainer = (path: string) => pathInDataDir(repoRoot, path);
const seconds = (since: number) => Math.round((performance.now() - since) / 100) / 10;

await mkdir(workDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
const exportStart = performance.now();
const counts = await exportCityFeatures(sql, files).finally(() => sql.end());
const exportSeconds = seconds(exportStart);

const buildStart = performance.now();
await runTool(repoRoot, 'tippecanoe', [
  '-o',
  inContainer(output),
  '--force',
  '--quiet',
  '--minimum-zoom=0',
  `--maximum-zoom=${cityTileMaxZoom}`,
  '-L',
  `${cityTileLayers.points}:${inContainer(files.points)}`,
  '-L',
  `${cityTileLayers.boundaries}:${inContainer(files.boundaries)}`,
  '--read-parallel',
  // The city ID becomes the feature ID, which the map uses for feature-state.
  '--use-attribute-for-id=id',
  // Each feature has its own minimum zoom, so tippecanoe must not drop features by itself.
  '--drop-rate=1',
  '--no-feature-limit',
  '--no-tile-size-limit',
  '--name=Flanr cities',
  '--attribution=© OpenStreetMap contributors',
]);

console.log(
  JSON.stringify(
    {
      output,
      ...counts,
      exportSeconds,
      buildSeconds: seconds(buildStart),
      sizeBytes: (await stat(output)).size,
    },
    null,
    2,
  ),
);
