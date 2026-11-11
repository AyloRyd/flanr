import type { Sql } from 'postgres';
import type { WikidataCity } from './entity.ts';

/** Wikidata IDs of a country's cities that are not in our copy yet or were fetched too long ago. */
export async function wikidataIdsToFetch(
  sql: Sql,
  countryCode: string,
  refreshAfterDays: number,
): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    SELECT DISTINCT c.wikidata_id AS id
    FROM cities c
    LEFT JOIN wikidata_entities w ON w.id = c.wikidata_id
    WHERE c.country_code = ${countryCode}
      AND c.in_source
      AND c.wikidata_id IS NOT NULL
      AND (w.id IS NULL OR w.fetched_at < now() - make_interval(days => ${refreshAfterDays}))
    ORDER BY 1
  `;
  return rows.map((row) => row.id);
}

export async function saveWikidataCities(sql: Sql, cities: WikidataCity[]): Promise<void> {
  if (cities.length === 0) return;
  const rows = cities.map((city) => ({
    id: city.id,
    label_en: city.labelEn,
    aliases: city.aliases,
    population: city.population,
    population_year: city.populationYear,
    area_km2: city.areaKm2,
    elevation_m: city.elevationM,
    website: city.website,
    founded: city.founded,
    wikipedia_urls: city.wikipediaUrls,
  }));
  await sql`
    INSERT INTO wikidata_entities (id, label_en, aliases, population, population_year, area_km2,
      elevation_m, website, founded, wikipedia_urls, fetched_at)
    SELECT r.id, r.label_en, r.aliases, r.population, r.population_year, r.area_km2,
           r.elevation_m, r.website, r.founded, r.wikipedia_urls, now()
    FROM jsonb_to_recordset(${sql.json(rows as never)})
      AS r(id text, label_en text, aliases jsonb, population integer, population_year smallint,
           area_km2 real, elevation_m integer, website text, founded smallint, wikipedia_urls jsonb)
    ON CONFLICT (id) DO UPDATE SET
      label_en = excluded.label_en, aliases = excluded.aliases, population = excluded.population,
      population_year = excluded.population_year, area_km2 = excluded.area_km2,
      elevation_m = excluded.elevation_m, website = excluded.website, founded = excluded.founded,
      wikipedia_urls = excluded.wikipedia_urls, fetched_at = excluded.fetched_at
  `;
}
