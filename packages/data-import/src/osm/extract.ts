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
  /** One extract, or several that together cover the country (the United Kingdom is in two). */
  pbfs: string[];
  workDir: string;
}): Promise<ExtractedFiles> {
  const inContainer = (path: string) => pathInDataDir(options.repoRoot, path);
  await mkdir(options.workDir, { recursive: true });

  const filtered = inContainer(resolve(options.workDir, 'filtered.osm.pbf'));
  const features = resolve(options.workDir, 'features.geojsonseq');
  const relations = resolve(options.workDir, 'relations.opl');

  const osmium = (args: string[]) => runTool(options.repoRoot, 'osmium', args);
  const filter = (pbf: string, output: string) =>
    osmium([
      'tags-filter',
      pbf,
      'nwr/place=city,town,village,hamlet',
      // National capitals, whatever their place type (see settlementType).
      'n/capital=yes',
      'r/boundary=administrative',
      '-o',
      output,
      '--overwrite',
    ]);

  const pbfs = options.pbfs.map(inContainer);
  const timestamps: Date[] = [];
  for (const pbf of pbfs) {
    timestamps.push(await replicationTimestamp(osmium, pbf));
  }
  const [onlyPbf] = pbfs;
  if (pbfs.length === 1 && onlyPbf) {
    await filter(onlyPbf, filtered);
  } else {
    // Merging also completes a boundary that each extract has only a part of.
    const parts = pbfs.map((_, index) =>
      inContainer(resolve(options.workDir, `filtered-${index}.osm.pbf`)),
    );
    for (const [index, pbf] of pbfs.entries()) {
      await filter(pbf, parts[index] ?? '');
    }
    await osmium(['merge', ...parts, '-o', filtered, '--overwrite']);
  }
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

  return { features, relations, sourceTimestamp: oldest(timestamps) };
}

async function replicationTimestamp(
  osmium: (args: string[]) => Promise<string>,
  pbf: string,
): Promise<Date> {
  const timestamp = await osmium([
    'fileinfo',
    '-g',
    'header.option.osmosis_replication_timestamp',
    pbf,
  ]);
  return new Date(timestamp.trim());
}

/** The data is as old as its oldest extract. Null if any extract does not say how old it is. */
function oldest(timestamps: Date[]): Date | null {
  const times = timestamps.map((timestamp) => timestamp.getTime());
  if (times.length === 0 || times.some(Number.isNaN)) return null;
  return new Date(Math.min(...times));
}
