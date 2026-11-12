import type { Sql } from 'postgres';
import type { CountryConfig } from '../countries.ts';
import { applyCities } from './apply.ts';
import { loadBoundaryLinks, loadFeatures } from './load.ts';
import { matchCities } from './match.ts';
import { createStaging, dropStaging } from './staging.ts';
import { defaultValidationOptions, validateCities, type ValidationOptions } from './validate.ts';

export interface ImportInput {
  country: CountryConfig;
  features: string;
  relations: string;
  sourceTimestamp: Date | null;
  validation?: ValidationOptions;
  /** Keep the staging tables after the run, to look into how cities were matched. */
  keepStaging?: boolean;
  log?: (message: string) => void;
}

export interface ImportResult {
  runId: number;
  ok: boolean;
  errors: string[];
  stats: Record<string, unknown>;
}

/**
 * Runs the import from exported OSM files to the live tables and records it in import_runs.
 * Nothing in the live tables changes unless validation passes and the apply transaction commits.
 */
export async function importCities(sql: Sql, input: ImportInput): Promise<ImportResult> {
  const log = input.log ?? (() => {});
  const runId = await startRun(sql, input);
  const stats: Record<string, unknown> = {};

  try {
    log('Loading staging tables');
    await createStaging(sql);
    Object.assign(stats, await loadFeatures(sql, input.features));
    stats.boundaryLinks = await loadBoundaryLinks(sql, input.relations);

    log('Matching settlements, boundaries and regions');
    await matchCities(sql, input.country);

    log('Validating');
    const validation = await validateCities(
      sql,
      input.country,
      input.validation ?? defaultValidationOptions,
    );
    Object.assign(stats, validation.stats);
    if (!validation.ok) {
      await finishRun(sql, runId, 'failed', stats, validation.errors.join('; '));
      return { runId, ok: false, errors: validation.errors, stats };
    }

    log('Applying');
    await applyCities(sql, input.country);
    await finishRun(sql, runId, 'succeeded', stats, null);
    return { runId, ok: true, errors: [], stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(sql, runId, 'failed', stats, message);
    throw error;
  } finally {
    if (!input.keepStaging) await dropStaging(sql);
  }
}

async function startRun(sql: Sql, input: ImportInput): Promise<number> {
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO import_runs (source_id, country_code, source_timestamp)
    VALUES ('openstreetmap', ${input.country.code}, ${input.sourceTimestamp})
    RETURNING id
  `;
  if (!row) throw new Error('Could not create import run');
  return row.id;
}

async function finishRun(
  sql: Sql,
  runId: number,
  status: 'succeeded' | 'failed',
  stats: Record<string, unknown>,
  error: string | null,
): Promise<void> {
  await sql`
    UPDATE import_runs SET status = ${status}, finished_at = now(), stats = ${sql.json(stats as never)}, error = ${error}
    WHERE id = ${runId}
  `;
}
