import { parseArgs } from 'node:util';
import postgres from 'postgres';
import { countryConfig } from '../countries.ts';
import { importWikidata } from './run.ts';

const usage = `Usage: pnpm import:wikidata --country DE [--refresh-days 30]

  --country       ISO 3166-1 alpha-2 code of the country to enrich
  --refresh-days  fetch items again if our copy is older than this (default 30)`;

const { values } = parseArgs({
  options: {
    country: { type: 'string' },
    'refresh-days': { type: 'string', default: '30' },
    help: { type: 'boolean', default: false },
  },
});

if (values.help || !values.country) {
  console.log(usage);
  process.exit(values.help ? 0 : 1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

// Wikimedia asks automated clients to identify themselves and give a way to reach the operator.
const userAgent =
  process.env.WIKIDATA_USER_AGENT ?? 'FlanrCityImport/0.1 (https://github.com/AyloRyd/flanr)';

const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
try {
  const stats = await importWikidata(sql, {
    country: countryConfig(values.country),
    refreshAfterDays: Number(values['refresh-days']),
    client: { userAgent },
    log: (message) => console.log(`[${new Date().toISOString()}] ${message}`),
  });
  console.log(JSON.stringify(stats, null, 2));
} finally {
  await sql.end();
}
