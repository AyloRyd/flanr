import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathInDataDir, runTool } from '../docker.ts';

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
  const inContainer = (path: string) => pathInDataDir(options.repoRoot, path);
  await mkdir(options.workDir, { recursive: true });

  const pbf = inContainer(options.pbf);
  const filtered = inContainer(resolve(options.workDir, 'filtered.osm.pbf'));
  const features = resolve(options.workDir, 'features.geojsonseq');
  const relations = resolve(options.workDir, 'relations.opl');

  const osmium = (args: string[]) => runTool(options.repoRoot, 'osmium', args);
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
    // National capitals, whatever their place type (see settlementType).
    'n/capital=yes',
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
