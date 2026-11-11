import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface ExtractedFiles {
  features: string;
  relations: string;
  sourceTimestamp: Date | null;
}

/**
 * Filters an OSM extract down to settlements and administrative boundaries and exports it in
 * two forms: GeoJSON features with geometry, and relations in OPL, which keep the member roles
 * (label, admin_centre) that GeoJSON loses.
 *
 * osmium runs in the Docker image from docker-compose.yml, which mounts ./data as /data,
 * so the input file must be inside the data directory.
 */
export async function extractOsm(options: {
  repoRoot: string;
  pbf: string;
  workDir: string;
}): Promise<ExtractedFiles> {
  const dataDir = resolve(options.repoRoot, 'data');
  const inContainer = (path: string) => {
    const inside = relative(dataDir, resolve(path));
    if (inside.startsWith('..')) {
      throw new Error(`${path} must be inside ${dataDir}`);
    }
    return inside;
  };
  await mkdir(options.workDir, { recursive: true });

  const pbf = inContainer(options.pbf);
  const filtered = inContainer(resolve(options.workDir, 'filtered.osm.pbf'));
  const features = resolve(options.workDir, 'features.geojsonseq');
  const relations = resolve(options.workDir, 'relations.opl');

  const osmium = (args: string[]) => runOsmium(options.repoRoot, args);
  const timestamp = await osmium([
    'fileinfo',
    '-g',
    'header.option.osmosis_replication_timestamp',
    pbf,
  ]);
  await osmium([
    'tags-filter',
    pbf,
    'nwr/place=city,town,village,hamlet',
    'r/boundary=administrative',
    '-o',
    filtered,
    '--overwrite',
  ]);
  await osmium([
    'export',
    filtered,
    '-f',
    'geojsonseq',
    '--add-unique-id=type_id',
    '--geometry-types=point,polygon',
    '-o',
    inContainer(features),
    '--overwrite',
  ]);
  await osmium([
    'cat',
    filtered,
    '-t',
    'relation',
    '-f',
    'opl',
    '-o',
    inContainer(relations),
    '--overwrite',
  ]);

  const parsed = new Date(timestamp.trim());
  return { features, relations, sourceTimestamp: Number.isNaN(parsed.getTime()) ? null : parsed };
}

async function runOsmium(repoRoot: string, args: string[]): Promise<string> {
  // Run as the current user so the output files are not owned by root.
  const user = `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`;
  const { stdout } = await run(
    'docker',
    ['compose', 'run', '--rm', '-T', '--user', user, 'osmium', ...args],
    { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout;
}
