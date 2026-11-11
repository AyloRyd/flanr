import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import postgres from 'postgres';
import { countryConfig } from './countries.ts';
import { extractOsm } from './osm/extract.ts';
import { importCities } from './pipeline/run.ts';

const usage = `Usage: pnpm import:osm --country DE --pbf data/raw/geofabrik/germany-latest.osm.pbf

  --country       ISO 3166-1 alpha-2 code of the country to import
  --pbf           OSM extract inside the data directory
  --skip-extract  reuse the files in data/work/<country> from an earlier run
  --files-of      use the extracted files of another country, for a small country that is
                  inside a neighbour's extract: --country VA --files-of IT --skip-extract
  --extract-only  stop after writing the files, without touching the database
  --keep-staging  keep the staging tables after the run, for looking into the matching`;

const { values } = parseArgs({
  options: {
    country: { type: 'string' },
    pbf: { type: 'string' },
    'skip-extract': { type: 'boolean', default: false },
    'files-of': { type: 'string' },
    'extract-only': { type: 'boolean', default: false },
    'keep-staging': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help || !values.country || (!values.pbf && !values['skip-extract'])) {
  console.log(usage);
  process.exit(values.help ? 0 : 1);
}

// pnpm runs package scripts in the package directory; paths are given relative to the repository root.
const repoRoot = resolve(import.meta.dirname, '../../..');
const filesCountry = (values['files-of'] ?? values.country).toLowerCase();
const workDir = resolve(repoRoot, 'data/work', filesCountry);
const sourceFile = resolve(workDir, 'source.json');
const log = (message: string) => console.log(`[${new Date().toISOString()}] ${message}`);

const files = values['skip-extract'] ? await extractedFiles() : await extract();

if (values['extract-only']) {
  console.log(JSON.stringify(files, null, 2));
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
try {
  const result = await importCities(sql, {
    country: countryConfig(values.country),
    ...files,
    log,
    keepStaging: values['keep-staging'],
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
} finally {
  await sql.end();
}

async function extract() {
  log('Extracting with osmium');
  const extracted = await extractOsm({
    repoRoot,
    pbf: resolve(repoRoot, values.pbf ?? ''),
    workDir,
  });
  // Remembered so that a later run with --skip-extract still knows how old the data is.
  await writeFile(sourceFile, JSON.stringify({ sourceTimestamp: extracted.sourceTimestamp }));
  return extracted;
}

async function extractedFiles() {
  const source = await readFile(sourceFile, 'utf8')
    .then((text) => JSON.parse(text) as { sourceTimestamp: string | null })
    .catch(() => ({ sourceTimestamp: null }));
  return {
    features: resolve(workDir, 'features.geojsonseq'),
    relations: resolve(workDir, 'relations.opl'),
    sourceTimestamp: source.sourceTimestamp ? new Date(source.sourceTimestamp) : null,
  };
}
