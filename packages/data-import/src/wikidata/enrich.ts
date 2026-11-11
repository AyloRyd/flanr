import type { TransactionSql } from 'postgres';
import type { CountryConfig } from '../countries.ts';

/**
 * Fills city fields from our copy of Wikidata (FR-CITY-002). It reads only the database, so it
 * runs both after fetching from Wikidata and inside the OSM import, which resets the OSM fields.
 *
 * Rules:
 * - English name: the OSM name:en, else the Wikidata English label, else the local name.
 * - Population: Wikidata wins when OSM has none, or when Wikidata's figure has a year that is not
 *   older than OSM's. An undated Wikidata figure never replaces an OSM one.
 * - Wikipedia link: the English article, else the link from OSM, else an article in a local language.
 * - Area, elevation, website and founding year come from Wikidata only.
 */
export async function enrichCitiesFromWikidata(
  tx: TransactionSql,
  country: CountryConfig,
): Promise<void> {
  const localSites = country.languages.map((language) => `${language}wiki`);

  await tx`
    UPDATE cities c SET
      name_en = coalesce(osm_en.name, w.label_en, c.name_local),
      population = CASE WHEN pick.wikidata THEN w.population ELSE c.population END,
      population_year = CASE WHEN pick.wikidata THEN w.population_year ELSE c.population_year END,
      population_source = CASE WHEN pick.wikidata THEN 'wikidata' ELSE c.population_source END,
      wikipedia_url = coalesce(w.wikipedia_urls ->> 'enwiki', c.wikipedia_url, local_article.url),
      area_km2 = w.area_km2,
      elevation_m = w.elevation_m,
      website = w.website,
      founded = w.founded
    FROM cities target
    LEFT JOIN wikidata_entities w ON w.id = target.wikidata_id
    LEFT JOIN LATERAL (
      SELECT n.name FROM city_names n
      WHERE n.city_id = target.id AND n.kind = 'name' AND n.lang = 'en'
      LIMIT 1
    ) osm_en ON true
    LEFT JOIN LATERAL (
      SELECT w.wikipedia_urls ->> site.key AS url
      FROM unnest(${localSites}::text[]) WITH ORDINALITY AS site(key, position)
      WHERE w.wikipedia_urls ? site.key
      ORDER BY site.position
      LIMIT 1
    ) local_article ON true
    CROSS JOIN LATERAL (
      SELECT w.population IS NOT NULL AND (
        target.population IS NULL
        OR target.population_source = 'wikidata'
        OR (w.population_year IS NOT NULL
            AND (target.population_year IS NULL OR w.population_year >= target.population_year))
      ) AS wikidata
    ) pick
    WHERE c.id = target.id AND target.country_code = ${country.code}
  `;

  await replaceWikidataNames(tx, country.code);
}

/** Wikidata's English label and its aliases become extra names for search (FR-SRCH-001). */
async function replaceWikidataNames(tx: TransactionSql, countryCode: string): Promise<void> {
  await tx`
    DELETE FROM city_names n USING cities c
    WHERE n.city_id = c.id AND c.country_code = ${countryCode}
      AND n.kind IN ('wikidata_label', 'wikidata_alias')
  `;
  await tx`
    INSERT INTO city_names (city_id, name, lang, kind)
    SELECT c.id, w.label_en, 'en', 'wikidata_label'
    FROM cities c JOIN wikidata_entities w ON w.id = c.wikidata_id
    WHERE c.country_code = ${countryCode} AND w.label_en IS NOT NULL
    UNION
    SELECT c.id, alias.name, by_language.lang, 'wikidata_alias'
    FROM cities c
    JOIN wikidata_entities w ON w.id = c.wikidata_id
    CROSS JOIN LATERAL jsonb_each(w.aliases) AS by_language(lang, names)
    CROSS JOIN LATERAL jsonb_array_elements_text(by_language.names) AS alias(name)
    WHERE c.country_code = ${countryCode}
    ON CONFLICT DO NOTHING
  `;
}
