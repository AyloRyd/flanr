import type { CitySearchPlan, CitySearchResult, Country, Region } from '@flanr/shared';
import type { Sql } from './db.ts';

export interface CitySearchParams extends CitySearchPlan {
  limit: number;
  offset: number;
}

/** Finds and lists cities (FR-SRCH-001, FR-SRCH-003). */
export type CitySearch = (params: CitySearchParams) => Promise<CitySearchResult[]>;

/** The countries and regions cities can be filtered by. */
export interface Geography {
  /** Countries that have cities, by English name. */
  countries(): Promise<Country[]>;
  /** The regions of a country: first level, then second level, by English name. */
  regions(countryCode: string): Promise<Region[]>;
}

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
 *
 * The same function lists cities without a search text, and filters and sorts either kind of
 * list (FR-SRCH-003).
 */
export function createCitySearch(sql: Sql): CitySearch {
  // Word for word the condition of the partial indexes, see cityNames in the database schema.
  const isMainName = sql`n.kind in ('name', 'int_name', 'wikidata_label')`;

  /** The cities that a search text finds, with how well each one matches. */
  function matchesOf(text: string, needed: number, withCloseSpellings: boolean) {
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
        WHERE ${withCloseSpellings}
          AND (SELECT count(*) FROM strict) < ${needed}
          AND ${text.length >= minFuzzyLength}
          AND n.search_name % ${text}
          AND ${isMainName}
          AND n.city_id NOT IN (SELECT city_id FROM strict)
        GROUP BY n.city_id
      )
      SELECT * FROM strict UNION ALL SELECT * FROM fuzzy`;
    // The name of the city that is closest to the query, to show why the city was found.
    const matchedName = sql`
      LEFT JOIN LATERAL (
        SELECT n.name, n.search_name FROM city_names n
        WHERE n.city_id = c.id
        ORDER BY n.search_name = ${text} DESC,
          (${startsWithQuery}) DESC,
          n.search_name IN (search_text(c.name_local), search_text(c.name_en)) DESC,
          similarity(n.search_name, ${text}) DESC, ${isMainName} DESC,
          length(n.name), n.name COLLATE "C"
        LIMIT 1
      ) AS matched ON true`;
    return { matches, matchedName };
  }

  return async (params) => {
    const { limit, offset, sort, minRating, minRatings } = params;
    let text: string | undefined;
    if (params.query !== undefined) {
      const [normalized] = await sql<{ text: string }[]>`
        SELECT search_text(${params.query}) AS text`;
      if (!normalized?.text) return [];
      text = normalized.text;
    }
    // Close spellings belong at the end of a list sorted by relevance. In a list sorted by
    // anything else they would stand among the real matches, so they are left out there.
    const named =
      text === undefined ? undefined : matchesOf(text, offset + limit, sort === 'relevance');

    // The community rating of every rated city (BR-009). Only joined when the list is sorted
    // or filtered by it; the ratings shown with each city are read for the page alone.
    const usesRatings = sort === 'rating' || sort === 'ratings' || minRatings > 0;
    const ratedOnly = minRatings > 0 || minRating !== undefined;
    const rated = sql`
      ${ratedOnly ? sql`JOIN` : sql`LEFT JOIN`} (
        SELECT city_id, round(avg(subjective), 2)::float8 AS rating, count(*)::int AS rating_count
        FROM city_ratings GROUP BY city_id
      ) AS rated ON rated.city_id = c.id`;

    const filters = [
      sql`c.in_source`,
      ...(params.country === undefined ? [] : [sql`c.country_code = ${params.country}`]),
      ...(params.regionId === undefined
        ? []
        : [sql`(c.region_1_id = ${params.regionId} OR c.region_2_id = ${params.regionId})`]),
      ...(params.settlementTypes === undefined
        ? []
        : [sql`c.settlement_type::text IN ${sql(params.settlementTypes)}`]),
      ...(params.populationMin === undefined ? [] : [sql`c.population >= ${params.populationMin}`]),
      ...(params.populationMax === undefined ? [] : [sql`c.population <= ${params.populationMax}`]),
      ...(minRatings > 0 ? [sql`rated.rating_count >= ${minRatings}`] : []),
      ...(minRating === undefined ? [] : [sql`rated.rating >= ${minRating}`]),
    ].reduce((all, filter) => sql`${all} AND ${filter}`);

    const direction = params.descending ? sql`DESC NULLS LAST` : sql`ASC NULLS LAST`;
    const largestFirst = sql`c.population DESC NULLS LAST, c.id`;
    const order = {
      relevance: sql`m.tier, m.score DESC, ${largestFirst}`,
      rating: sql`rated.rating ${direction}, rated.rating_count DESC NULLS LAST, ${largestFirst}`,
      ratings: sql`rated.rating_count ${direction}, rated.rating DESC NULLS LAST, ${largestFirst}`,
      population: sql`c.population ${direction}, c.id`,
      // A name is never missing, and without NULLS LAST the index can be read backwards.
      name: params.descending ? sql`c.name_local DESC, c.id DESC` : sql`c.name_local, c.id`,
    }[sort];

    return sql<CitySearchResult[]>`
      WITH ${named ? sql`matches AS (${named.matches}),` : sql``}
      page AS (
        -- The numbers are given after the page is cut out, so only the page is numbered.
        SELECT id, row_number() OVER () AS position
        FROM (
          SELECT c.id
          FROM cities c
          ${named ? sql`JOIN matches m ON m.city_id = c.id` : sql``}
          ${usesRatings || ratedOnly ? rated : sql``}
          WHERE ${filters}
          ORDER BY ${order}
          LIMIT ${limit} OFFSET ${offset}
        ) AS ordered
      )
      SELECT c.id, c.name_local AS name, c.name_en AS "nameEn",
        ${
          named
            ? sql`CASE WHEN search_text(c.name_local) = matched.search_name
                  OR search_text(c.name_en) = matched.search_name
                THEN NULL ELSE matched.name END`
            : sql`NULL`
        } AS "matchedName",
        c.settlement_type AS "settlementType", c.population,
        json_build_object('code', country.code, 'name', country.name_en) AS country,
        region.name_en AS region,
        CASE WHEN c.represents_municipality THEN NULL ELSE municipality.name_local END
          AS municipality,
        community.rating, community.rating_count AS "ratingCount"
      FROM page
      JOIN cities c ON c.id = page.id
      JOIN countries country ON country.code = c.country_code
      LEFT JOIN regions region ON region.id = c.region_1_id
      LEFT JOIN municipalities municipality ON municipality.id = c.municipality_id
      CROSS JOIN LATERAL (
        SELECT round(avg(subjective), 2)::float8 AS rating, count(*)::int AS rating_count
        FROM city_ratings WHERE city_id = c.id
      ) AS community
      ${named ? named.matchedName : sql``}
      ORDER BY page.position`;
  };
}

export function createGeography(sql: Sql): Geography {
  return {
    async countries() {
      return sql<Country[]>`
        SELECT code, name_en AS name, name_local AS "nameLocal" FROM countries
        WHERE EXISTS (SELECT 1 FROM cities WHERE country_code = countries.code AND in_source)
        ORDER BY name_en`;
    },

    async regions(countryCode) {
      return sql<Region[]>`
        SELECT id, name_en AS name, name_local AS "nameLocal", level FROM regions
        WHERE country_code = ${countryCode} AND in_source
        ORDER BY level, name_en, id`;
    },
  };
}
