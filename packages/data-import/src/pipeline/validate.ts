import type { Sql } from 'postgres';

export interface ValidationOptions {
  /** The import fails if the number of cities drops below this share of the cities already in the database. */
  minShareOfExisting: number;
  /** The import fails if more than this share of cities has no first-level region. */
  maxShareWithoutRegion: number;
}

export const defaultValidationOptions: ValidationOptions = {
  minShareOfExisting: 0.9,
  maxShareWithoutRegion: 0.005,
};

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  stats: CityStats;
}

export interface CityStats {
  cities: number;
  existingCities: number;
  withoutRegion: number;
  withBoundary: number;
  withPopulation: number;
  byType: Record<string, number>;
  byBoundaryMatch: Record<string, number>;
}

/** Checks staging.city before it replaces the live data (FR-CITY-006). */
export async function validateCities(
  sql: Sql,
  countryCode: string,
  options: ValidationOptions = defaultValidationOptions,
): Promise<ValidationResult> {
  const stats = await cityStats(sql, countryCode);
  const errors: string[] = [];

  if (stats.cities === 0) {
    errors.push('No cities found in the extract');
  }
  if (
    stats.existingCities > 0 &&
    stats.cities < stats.existingCities * options.minShareOfExisting
  ) {
    errors.push(
      `City count dropped from ${stats.existingCities} to ${stats.cities}, ` +
        `below ${options.minShareOfExisting * 100}% of the current data`,
    );
  }
  if (stats.cities > 0 && stats.withoutRegion / stats.cities > options.maxShareWithoutRegion) {
    errors.push(`${stats.withoutRegion} of ${stats.cities} cities have no first-level region`);
  }

  return { ok: errors.length === 0, errors, stats };
}

async function cityStats(sql: Sql, countryCode: string): Promise<CityStats> {
  const [totals] = await sql`
    SELECT count(*)::int AS cities,
           count(*) FILTER (WHERE region_1_osm_id IS NULL)::int AS without_region,
           count(boundary)::int AS with_boundary,
           count(population)::int AS with_population,
           (SELECT count(*)::int FROM cities WHERE country_code = ${countryCode} AND in_source) AS existing
    FROM staging.city
  `;
  const byType = await countBy(sql, 'settlement_type');
  const byBoundaryMatch = await countBy(sql, "coalesce(boundary_match, 'none')");
  return {
    cities: totals?.cities ?? 0,
    existingCities: totals?.existing ?? 0,
    withoutRegion: totals?.without_region ?? 0,
    withBoundary: totals?.with_boundary ?? 0,
    withPopulation: totals?.with_population ?? 0,
    byType,
    byBoundaryMatch,
  };
}

async function countBy(sql: Sql, expression: string): Promise<Record<string, number>> {
  const rows = await sql.unsafe<{ key: string; count: number }[]>(
    `SELECT ${expression}::text AS key, count(*)::int AS count FROM staging.city GROUP BY 1 ORDER BY 1`,
  );
  return Object.fromEntries(rows.map((row) => [row.key, row.count]));
}
