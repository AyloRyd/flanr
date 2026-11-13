import {
  criteriaAverage,
  type CityRating,
  type CommunityRating,
  type CreateCriterion,
  type Criterion,
  type ManagedCriterion,
  type UpdateCriterion,
} from '@flanr/shared';
import type { TransactionSql } from 'postgres';
import { cityExists } from './cities.ts';
import type { Sql } from './db.ts';
import { isVisited, lockDefaultLists, type CityListOptions } from './default-lists.ts';

export interface RatingInput {
  subjective: number;
  /** By criterion key. Criteria that are left out are not rated. */
  criteria: Record<string, number>;
}

export type SetRatingResult =
  | { rating: CityRating }
  /** BR-005: the user has neither a visit to the city nor a lived-in mark on it. */
  | { problem: 'not_visited' }
  | { problem: 'unknown_criteria'; keys: string[] };

/**
 * Reads and changes city ratings. Every method that takes the user only ever touches that
 * user's ratings (NFR-SEC-003).
 */
export interface RatingStore {
  cityExists(cityId: number): Promise<boolean>;
  /** The criteria users can rate now, in display order. */
  listCriteria(): Promise<Criterion[]>;
  /** Ordered by city ID. */
  list(userId: number, options: CityListOptions): Promise<CityRating[]>;
  find(userId: number, cityId: number): Promise<CityRating | null>;
  /** Creates the rating or replaces it as a whole (BR-008). */
  set(userId: number, cityId: number, input: RatingInput): Promise<SetRatingResult>;
  remove(userId: number, cityId: number): Promise<boolean>;

  /** The ratings of all users together, without saying whose they are (BR-009, FR-PRIV-002). */
  communityRating(cityId: number): Promise<CommunityRating>;

  /** For administrators (FR-RATE-006): all criteria, also those that are switched off. */
  listAllCriteria(): Promise<ManagedCriterion[]>;
  /** Returns null if the key is taken. */
  createCriterion(input: CreateCriterion): Promise<ManagedCriterion | null>;
  /** Returns null if there is no criterion with this key. */
  updateCriterion(key: string, changes: UpdateCriterion): Promise<ManagedCriterion | null>;
}

/** What removing a visit or a lived-in mark can come to. */
export type RemovalResult = 'removed' | 'not_found' | 'rating_needs_confirmation';

class RatingNeedsConfirmation extends Error {}

/**
 * Keeps BR-005 after a visit or a lived-in mark was removed in this transaction: if the city
 * is no longer visited, the user's rating of it is deleted too, but only if the user has
 * confirmed that. Without the confirmation the transaction is rolled back; see
 * unlessRatingNeedsConfirmation. The caller holds the lock of lockDefaultLists.
 */
export async function dropRatingIfNotVisited(
  tx: TransactionSql,
  userId: number,
  cityId: number,
  confirmed: boolean,
): Promise<void> {
  if (await isVisited(tx, userId, cityId)) return;
  const rated = await tx`
    SELECT 1 FROM city_ratings WHERE user_id = ${userId} AND city_id = ${cityId}`;
  if (rated.length === 0) return;
  if (!confirmed) throw new RatingNeedsConfirmation();
  // The criteria ratings go with it through the foreign key.
  await tx`DELETE FROM city_ratings WHERE user_id = ${userId} AND city_id = ${cityId}`;
}

/** Runs a transaction that calls dropRatingIfNotVisited and reports a missing confirmation. */
export async function unlessRatingNeedsConfirmation<Result>(
  run: () => Promise<Result>,
): Promise<Result | 'rating_needs_confirmation'> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof RatingNeedsConfirmation) return 'rating_needs_confirmation';
    throw error;
  }
}

interface RatingRow {
  city_id: number;
  subjective: number;
  criteria: Record<string, number>;
  created_at: Date;
  updated_at: Date;
}

const toRating = (row: RatingRow): CityRating => ({
  cityId: row.city_id,
  subjective: row.subjective,
  criteria: row.criteria,
  criteriaAverage: criteriaAverage(Object.values(row.criteria)),
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export function createRatingStore(sql: Sql): RatingStore {
  // Ratings of a criterion that was switched off stay stored but are not part of the rating.
  const columns = sql`
    rating.city_id, rating.subjective::float8 AS subjective, rating.created_at, rating.updated_at,
    COALESCE((
      SELECT jsonb_object_agg(criteria.key, criterion_ratings.value)
      FROM criterion_ratings
      JOIN criteria ON criteria.id = criterion_ratings.criterion_id AND criteria.active
      WHERE criterion_ratings.user_id = rating.user_id
        AND criterion_ratings.city_id = rating.city_id
    ), '{}') AS criteria`;

  const managedColumns = sql`key, name, active, sort_order AS "sortOrder"`;

  async function find(db: Sql | TransactionSql, userId: number, cityId: number) {
    const [row] = await db<RatingRow[]>`
      SELECT ${columns} FROM city_ratings AS rating
      WHERE rating.user_id = ${userId} AND rating.city_id = ${cityId}`;
    return row ? toRating(row) : null;
  }

  return {
    cityExists: (cityId) => cityExists(sql, cityId),

    async listCriteria() {
      return sql<Criterion[]>`
        SELECT key, name FROM criteria WHERE active ORDER BY sort_order, id`;
    },

    async list(userId, { afterCityId, limit }) {
      const rows = await sql<RatingRow[]>`
        SELECT ${columns} FROM city_ratings AS rating
        WHERE rating.user_id = ${userId}
          ${afterCityId === undefined ? sql`` : sql`AND rating.city_id > ${afterCityId}`}
        ORDER BY rating.city_id
        LIMIT ${limit}`;
      return rows.map(toRating);
    },

    find: (userId, cityId) => find(sql, userId, cityId),

    async set(userId, cityId, { subjective, criteria }) {
      return sql.begin(async (tx): Promise<SetRatingResult> => {
        // The last visit must not be deleted while the rating is being saved (BR-005).
        await lockDefaultLists(tx, userId, cityId);
        if (!(await isVisited(tx, userId, cityId))) return { problem: 'not_visited' };

        const active = await tx<{ id: number; key: string }[]>`
          SELECT id, key FROM criteria WHERE active`;
        const activeKeys = new Set(active.map((criterion) => criterion.key));
        const unknown = Object.keys(criteria).filter((key) => !activeKeys.has(key));
        if (unknown.length > 0) return { problem: 'unknown_criteria', keys: unknown };

        await tx`
          INSERT INTO city_ratings (user_id, city_id, subjective)
          VALUES (${userId}, ${cityId}, ${subjective})
          ON CONFLICT (user_id, city_id) DO UPDATE
          SET subjective = EXCLUDED.subjective, updated_at = now()`;
        await tx`
          DELETE FROM criterion_ratings
          WHERE user_id = ${userId} AND city_id = ${cityId}
            AND criterion_id IN (SELECT id FROM criteria WHERE active)`;
        const values = active.flatMap(({ id, key }) => {
          const value = criteria[key];
          return value === undefined
            ? []
            : [{ user_id: userId, city_id: cityId, criterion_id: id, value }];
        });
        if (values.length > 0) await tx`INSERT INTO criterion_ratings ${tx(values)}`;

        const rating = await find(tx, userId, cityId);
        if (!rating) throw new Error('Rating could not be saved');
        return { rating };
      });
    },

    async remove(userId, cityId) {
      const rows = await sql`
        DELETE FROM city_ratings WHERE user_id = ${userId} AND city_id = ${cityId}
        RETURNING city_id`;
      return rows.length > 0;
    },

    async communityRating(cityId) {
      // Rounded in the database, where the ratings are exact decimals.
      const [overall] = await sql<{ average: number | null; count: number }[]>`
        SELECT round(avg(subjective), 2)::float8 AS average, count(*)::int AS count
        FROM city_ratings WHERE city_id = ${cityId}`;
      const criteria = await sql<CommunityRating['criteria']>`
        SELECT criteria.key, criteria.name,
          round(avg(criterion_ratings.value), 2)::float8 AS average,
          count(criterion_ratings.value)::int AS count
        FROM criteria
        LEFT JOIN criterion_ratings
          ON criterion_ratings.criterion_id = criteria.id AND criterion_ratings.city_id = ${cityId}
        WHERE criteria.active
        GROUP BY criteria.id
        ORDER BY criteria.sort_order, criteria.id`;
      return {
        cityId,
        average: overall?.average ?? null,
        count: overall?.count ?? 0,
        criteria: [...criteria],
      };
    },

    async listAllCriteria() {
      return sql<ManagedCriterion[]>`
        SELECT ${managedColumns} FROM criteria ORDER BY sort_order, id`;
    },

    async createCriterion({ key, name, sortOrder }) {
      const [row] = await sql<ManagedCriterion[]>`
        INSERT INTO criteria (key, name, sort_order)
        VALUES (${key}, ${name},
          ${sortOrder ?? sql`(SELECT COALESCE(max(sort_order), 0) + 10 FROM criteria)`})
        ON CONFLICT (key) DO NOTHING
        RETURNING ${managedColumns}`;
      return row ?? null;
    },

    async updateCriterion(key, { name, active, sortOrder }) {
      const [row] = await sql<ManagedCriterion[]>`
        UPDATE criteria SET
          name = COALESCE(${name ?? null}, name),
          active = COALESCE(${active ?? null}, active),
          sort_order = COALESCE(${sortOrder ?? null}, sort_order)
        WHERE key = ${key}
        RETURNING ${managedColumns}`;
      return row ?? null;
    },
  };
}

/** For places that never reach the ratings, such as writing the OpenAPI document. */
export const noRatingStore = new Proxy({} as RatingStore, {
  get: () => () => {
    throw new Error('Ratings are not available here');
  },
});
