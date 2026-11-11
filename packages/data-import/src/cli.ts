import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import postgres from 'postgres';
import { countryConfig } from './countries.ts';
import { extractOsm } from './osm/extract.ts';
import { importCities } from './pipeline/run.ts';

const usage = `Usage: pnpm import:osm --country DE --pbf data/raw/geofabrik/germany-latest.osm.pbf [--skip-extract]

  --country       ISO 3166-1 alpha-2 code of the country to import
  --pbf           OSM extract inside the data directory
  --skip-extract  reuse the files in data/work/<country> from an earlier run
  --keep-staging  keep the staging tables after the run, for looking into the matching`;

const { values } = parseArgs({
  options: {
    country: { type: 'string' },
    pbf: { type: 'string' },
    'skip-extract': { type: 'boolean', default: false },
    'keep-staging': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help || !values.country || (!values.pbf && !values['skip-extract'])) {
  console.log(usage);
  process.exit(values.help ? 0 : 1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

// pnpm runs package scripts in the package directory; paths are given relative to the repository root.
const repoRoot = resolve(import.meta.dirname, '../../..');
const country = countryConfig(values.country);
const workDir = resolve(repoRoot, 'data/work', country.code.toLowerCase());
const log = (message: string) => console.log(`[${new Date().toISOString()}] ${message}`);

const files = values['skip-extract']
  ? {
      features: resolve(workDir, 'features.geojsonseq'),
      relations: resolve(workDir, 'relations.opl'),
      sourceTimestamp: null,
    }
  : (log('Extracting with osmium'),
    await extractOsm({ repoRoot, pbf: resolve(repoRoot, values.pbf ?? ''), workDir }));

const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
try {
  const result = await importCities(sql, {
    country,
    ...files,
    log,
    keepStaging: values['keep-staging'],
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
} finally {
  await sql.end();
}
