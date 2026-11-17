import type { MapCity, PlannedCity, UserMap, VisitedCity, VisitedMapCity } from '@flanr/shared';
import type { TransactionSql } from 'postgres';
import { cityExists } from './cities.ts';
import type { Sql } from './db.ts';

export interface CityListOptions {
  /** Returns cities with a larger ID than this one, for the next page. */
  afterCityId?: number | undefined;
  limit: number;
}

/**
 * Reads the two default lists and changes the Planned list (FR-LIST-001, FR-LIST-002). Every
 * method takes the user and only ever touches that user's lists (NFR-SEC-003).
 */
export interface DefaultListStore {
  cityExists(cityId: number): Promise<boolean>;
  /** Ordered by city ID. */
  listVisited(userId: number, options: CityListOptions): Promise<VisitedCity[]>;
  /** Ordered by city ID. */
  listPlanned(userId: number, options: CityListOptions): Promise<PlannedCity[]>;
  /** Returns null, and plans nothing, if the user has already visited the city (BR-004). */
  plan(userId: number, cityId: number): Promise<PlannedCity | null>;
  unplan(userId: number, cityId: number): Promise<boolean>;
  /** Where the city stands in the user's default lists, and how often the user was there. */
  cityStatus(userId: number, cityId: number): Promise<DefaultListStatus>;
  /** Both lists with what the map shows of each city, ordered by city ID (FR-MAP-005, FR-MAP-006). */
  map(userId: number): Promise<UserMap>;
}

export interface DefaultListStatus {
  visitCount: number;
  undatedVisitCount: number;
  visited: boolean;
  planned: boolean;
}

/**
 * Makes everything that decides which default list a city is in wait its turn: planning the
 * city, logging a visit to it and marking it as lived-in. Without it, a visit and a plan saved
 * at the same moment would each miss the other and leave the city in both lists (BR-004).
 */
export async function lockDefaultLists(
  tx: TransactionSql,
  userId: number,
  cityId: number,
): Promise<void> {
  await tx`SELECT pg_advisory_xact_lock(${userId}, ${cityId})`;
}

/**
 * Takes the city off the Planned list because it is about to become visited (BR-004). The
 * caller adds the visit or the lived-in mark in the same transaction.
 */
export async function leavePlannedList(
  tx: TransactionSql,
  userId: number,
  cityId: number,
): Promise<void> {
  await lockDefaultLists(tx, userId, cityId);
  await tx`DELETE FROM planned_cities WHERE user_id = ${userId} AND city_id = ${cityId}`;
}

/** Whether the city is in the user's Visited list: it has a visit or a lived-in mark (BR-004). */
export async function isVisited(
  sql: Sql | TransactionSql,
  userId: number,
  cityId: number,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM visits WHERE user_id = ${userId} AND city_id = ${cityId}
    UNION ALL
    SELECT 1 FROM lived_cities WHERE user_id = ${userId} AND city_id = ${cityId}
    LIMIT 1`;
  return rows.length > 0;
}

interface PlannedRow {
  city_id: number;
  created_at: Date;
}

const toPlannedCity = (row: PlannedRow): PlannedCity => ({
  cityId: row.city_id,
  addedAt: row.created_at.toISOString(),
});

interface VisitedRow {
  city_id: number;
  visit_count: number;
  lived_in: boolean;
}

/**
 * One row per city of the user's Visited list, with the number of visits and whether the user
 * has lived there (BR-004, BR-016).
 */
const visitedMarks = (sql: Sql, userId: number) => sql`
  SELECT city_id, sum(visits)::int AS visit_count, bool_or(lived) AS lived_in
  FROM (
    SELECT city_id, count(*) AS visits, false AS lived
    FROM visits WHERE user_id = ${userId} GROUP BY city_id
    UNION ALL
    SELECT city_id, 0, true FROM lived_cities WHERE user_id = ${userId}
  ) AS each_mark
  GROUP BY city_id`;

/**
 * The columns of a city on the map. Coordinates are rounded to about a metre, which is far
 * finer than a marker and keeps the response of a user with a thousand cities small.
 */
const mapCityColumns = (sql: Sql) => sql`
  c.id AS "cityId",
  round(ST_X(c.centre)::numeric, 5)::float8 AS longitude,
  round(ST_Y(c.centre)::numeric, 5)::float8 AS latitude,
  c.settlement_type AS "settlementType",
  c.population`;

export function createDefaultListStore(sql: Sql): DefaultListStore {
  return {
    cityExists: (cityId) => cityExists(sql, cityId),

    async listVisited(userId, { afterCityId, limit }) {
      const rows = await sql<VisitedRow[]>`
        SELECT city_id, visit_count, lived_in
        FROM (${visitedMarks(sql, userId)}) AS marks
        ${afterCityId === undefined ? sql`` : sql`WHERE city_id > ${afterCityId}`}
        ORDER BY city_id
        LIMIT ${limit}`;
      return rows.map((row) => ({
        cityId: row.city_id,
        visitCount: row.visit_count,
        livedIn: row.lived_in,
      }));
    },

    async listPlanned(userId, { afterCityId, limit }) {
      const rows = await sql<PlannedRow[]>`
        SELECT city_id, created_at FROM planned_cities
        WHERE user_id = ${userId}
          ${afterCityId === undefined ? sql`` : sql`AND city_id > ${afterCityId}`}
        ORDER BY city_id
        LIMIT ${limit}`;
      return rows.map(toPlannedCity);
    },

    async plan(userId, cityId) {
      return sql.begin(async (tx) => {
        await lockDefaultLists(tx, userId, cityId);
        if (await isVisited(tx, userId, cityId)) return null;

        // Planning a planned city again keeps the time it was first added.
        const [row] = await tx<PlannedRow[]>`
          INSERT INTO planned_cities (user_id, city_id) VALUES (${userId}, ${cityId})
          ON CONFLICT (user_id, city_id) DO UPDATE SET city_id = EXCLUDED.city_id
          RETURNING city_id, created_at`;
        if (!row) throw new Error('City could not be planned');
        return toPlannedCity(row);
      });
    },

    async cityStatus(userId, cityId) {
      const [row] = await sql<DefaultListStatus[]>`
        SELECT
          (SELECT count(*)::int FROM visits
            WHERE user_id = ${userId} AND city_id = ${cityId}) AS "visitCount",
          (SELECT count(*)::int FROM visits
            WHERE user_id = ${userId} AND city_id = ${cityId} AND date IS NULL)
            AS "undatedVisitCount",
          EXISTS (SELECT 1 FROM planned_cities
            WHERE user_id = ${userId} AND city_id = ${cityId}) AS planned`;
      if (!row) throw new Error('City status could not be read');
      return { ...row, visited: await isVisited(sql, userId, cityId) };
    },

    async map(userId) {
      const [visited, planned] = await Promise.all([
        sql<VisitedMapCity[]>`
          SELECT ${mapCityColumns(sql)}, marks.visit_count AS "visitCount",
            marks.lived_in AS "livedIn", rating.subjective::float8 AS rating
          FROM (${visitedMarks(sql, userId)}) AS marks
          JOIN cities c ON c.id = marks.city_id
          LEFT JOIN city_ratings rating
            ON rating.user_id = ${userId} AND rating.city_id = marks.city_id
          ORDER BY c.id`,
        sql<MapCity[]>`
          SELECT ${mapCityColumns(sql)}
          FROM planned_cities planned
          JOIN cities c ON c.id = planned.city_id
          WHERE planned.user_id = ${userId}
          ORDER BY c.id`,
      ]);
      return { visited, planned };
    },

    async unplan(userId, cityId) {
      const rows = await sql`
        DELETE FROM planned_cities WHERE user_id = ${userId} AND city_id = ${cityId}
        RETURNING city_id`;
      return rows.length > 0;
    },
  };
}

/** For places that never reach the lists, such as writing the OpenAPI document. */
export const noDefaultListStore = new Proxy({} as DefaultListStore, {
  get: () => () => {
    throw new Error('Default lists are not available here');
  },
});
