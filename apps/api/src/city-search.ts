import type { CitySearchResult } from '@flanr/shared';
import type { Sql } from './db.ts';

export interface CitySearchParams {
  query: string;
  limit: number;
  offset: number;
}

/** Finds cities by name (FR-SRCH-001), best match first. */
export type CitySearch = (params: CitySearchParams) => Promise<CitySearchResult[]>;

/**
 * Names that start with the query are looked for from this many characters on. A single
 * letter is the beginning of the names of a tenth of all cities, too many to rank in time.
 */
const minPrefixLength = 2;

/** Close spellings are only looked for when the query is long enough to have a few trigrams. */
const minFuzzyLength = 4;

/**
 * Search over all names of a city: local, English, other languages, alternative and former
 * names. Names are compared as `search_text` leaves them, in lower case and without diacritics,
 * so "Koln" finds Köln. The order is:
 *
 * 1. cities with a name that is exactly the query,
 * 2. cities with a main name that starts with it, if the query has at least two characters,
 * 3. if these do not fill the page, cities with a main name spelled almost like it (trigrams),
 *
 * and within each group the largest city first. Main names are the names of a city in some
 * language. Alternative, former, official and short names and nicknames only count when they
 * are the whole query: "Kiev" finds Kyiv, but "St" does not find Berlin through "Stadt Berlin".
 */
export function createCitySearch(sql: Sql): CitySearch {
  // Word for word the condition of the partial indexes, see cityNames in the database schema.
  const isMainName = sql`n.kind in ('name', 'int_name', 'wikidata_label')`;

  return async ({ query, limit, offset }) => {
    const [normalized] = await sql<{ text: string }[]>`SELECT search_text(${query}) AS text`;
    if (!normalized?.text) return [];
    const text = normalized.text;
    const needed = offset + limit;

    // Main names that start with the query, as a range of the index on search_name.
    const startsWithQuery = sql`
      n.search_name ~>=~ ${text} AND n.search_name ~<~ (${text} || chr(1114111))
      AND ${isMainName}`;

    const matches = sql`
      WITH strict AS (
        SELECT city_id, min(tier) AS tier, 1::real AS score
        FROM (
          SELECT n.city_id, 0 AS tier FROM city_names n WHERE n.search_name = ${text}
          UNION ALL
          SELECT n.city_id, 1 FROM city_names n
          WHERE ${text.length >= minPrefixLength} AND ${startsWithQuery}
        ) AS named
        GROUP BY city_id
      ),
      -- Only read when the strict matches do not fill the page.
      fuzzy AS (
        SELECT n.city_id, 2 AS tier, max(similarity(n.search_name, ${text})) AS score
        FROM city_names n
        WHERE (SELECT count(*) FROM strict) < ${needed}
          AND ${text.length >= minFuzzyLength}
          AND n.search_name % ${text}
          AND ${isMainName}
          AND n.city_id NOT IN (SELECT city_id FROM strict)
        GROUP BY n.city_id
      )
      SELECT * FROM strict UNION ALL SELECT * FROM fuzzy`;

    return sql<CitySearchResult[]>`
      WITH matches AS (${matches}),
      page AS (
        SELECT c.id, m.tier, m.score
        FROM matches m JOIN cities c ON c.id = m.city_id
        WHERE c.in_source
        ORDER BY m.tier, m.score DESC, c.population DESC NULLS LAST, c.id
        LIMIT ${limit} OFFSET ${offset}
      )
      SELECT c.id, c.name_local AS name, c.name_en AS "nameEn",
        CASE WHEN search_text(c.name_local) = matched.search_name
            OR search_text(c.name_en) = matched.search_name
          THEN NULL ELSE matched.name END AS "matchedName",
        c.settlement_type AS "settlementType", c.population,
        json_build_object('code', country.code, 'name', country.name_en) AS country,
        region.name_en AS region,
        CASE WHEN c.represents_municipality THEN NULL ELSE municipality.name_local END
          AS municipality
      FROM page
      JOIN cities c ON c.id = page.id
      JOIN countries country ON country.code = c.country_code
      LEFT JOIN regions region ON region.id = c.region_1_id
      LEFT JOIN municipalities municipality ON municipality.id = c.municipality_id
      -- The name of the city that is closest to the query, to show why the city was found.
      LEFT JOIN LATERAL (
        SELECT n.name, n.search_name FROM city_names n
        WHERE n.city_id = c.id
        ORDER BY n.search_name = ${text} DESC,
          (${startsWithQuery}) DESC,
          n.search_name IN (search_text(c.name_local), search_text(c.name_en)) DESC,
          similarity(n.search_name, ${text}) DESC, ${isMainName} DESC,
          length(n.name), n.name COLLATE "C"
        LIMIT 1
      ) AS matched ON true
      ORDER BY page.tier, page.score DESC, c.population DESC NULLS LAST, c.id`;
  };
}
