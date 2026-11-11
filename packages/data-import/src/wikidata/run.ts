import type { Sql } from 'postgres';
import type { CountryConfig } from '../countries.ts';
import { fetchWikidataCities, type WikidataClientOptions } from './client.ts';
import { enrichCitiesFromWikidata } from './enrich.ts';
import { saveWikidataCities, wikidataIdsToFetch } from './store.ts';

export interface WikidataImportInput {
  country: CountryConfig;
  /** Items fetched more than this many days ago are fetched again. */
  refreshAfterDays: number;
  client: Omit<WikidataClientOptions, 'languages'>;
  log?: (message: string) => void;
}

export interface WikidataImportStats {
  requested: number;
  fetched: number;
  missing: number;
}

/**
 * Fetches the Wikidata items of a country's cities into our copy and enriches the cities from it.
 * Each batch is saved as it arrives, so an interrupted run continues where it stopped.
 */
export async function importWikidata(
  sql: Sql,
  input: WikidataImportInput,
): Promise<WikidataImportStats> {
  const log = input.log ?? (() => {});
  const ids = await wikidataIdsToFetch(sql, input.country.code, input.refreshAfterDays);
  const stats: WikidataImportStats = { requested: ids.length, fetched: 0, missing: 0 };
  const [run] = await sql<{ id: number }[]>`
    INSERT INTO import_runs (source_id, country_code) VALUES ('wikidata', ${input.country.code})
    RETURNING id
  `;
  const finish = (status: 'succeeded' | 'failed', error: string | null) => sql`
    UPDATE import_runs
    SET status = ${status}, finished_at = now(), stats = ${sql.json(stats as never)}, error = ${error}
    WHERE id = ${run?.id ?? 0}
  `;

  try {
    log(`Fetching ${ids.length} items from Wikidata`);
    const batches = fetchWikidataCities(ids, {
      ...input.client,
      languages: input.country.languages,
    });
    for await (const batch of batches) {
      await saveWikidataCities(sql, batch.cities);
      stats.fetched += batch.cities.length;
      stats.missing += batch.missing.length;
      if ((stats.fetched + stats.missing) % 5000 < batch.cities.length + batch.missing.length) {
        log(`${stats.fetched + stats.missing} of ${ids.length}`);
      }
    }

    log('Enriching cities');
    await sql.begin((tx) => enrichCitiesFromWikidata(tx, input.country));
    await finish('succeeded', null);
    return stats;
  } catch (error) {
    await finish('failed', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
