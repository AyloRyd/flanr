import {
  formatVisitDate,
  type LivedCity,
  type ParsedVisitDate,
  type VisitDatePrecision,
} from '@flanr/shared';
import { cityExists } from './cities.ts';
import type { Sql } from './db.ts';
import { leavePlannedList, lockDefaultLists } from './default-lists.ts';
import {
  dropRatingIfNotVisited,
  unlessRatingNeedsConfirmation,
  type RemovalResult,
} from './ratings.ts';

export interface LivedCityInput {
  isCurrent: boolean;
  from: ParsedVisitDate | null;
  to: ParsedVisitDate | null;
}

/**
 * Reads and changes lived-in cities (BR-016). Every method takes the user and only ever
 * touches that user's cities (NFR-SEC-003).
 */
export interface LivedCityStore {
  cityExists(cityId: number): Promise<boolean>;
  /** Ordered by city ID. `afterCityId` starts the next page. */
  list(
    userId: number,
    options: { afterCityId?: number | undefined; limit: number },
  ): Promise<LivedCity[]>;
  /**
   * Marks the city as lived-in or changes its mark. A new current city replaces the previous
   * one, which becomes a past city (FR-VIS-010).
   */
  set(userId: number, cityId: number, input: LivedCityInput): Promise<LivedCity>;
  /**
   * Removing the mark from a rated city without visits deletes the rating too, which the user
   * has to confirm (BR-005).
   */
  remove(userId: number, cityId: number, confirmRatingDeletion: boolean): Promise<RemovalResult>;
}

interface LivedCityRow {
  city_id: number;
  is_current: boolean;
  from_date: string | null;
  from_precision: VisitDatePrecision | 'none';
  to_date: string | null;
  to_precision: VisitDatePrecision | 'none';
}

const formatted = (date: string | null, precision: VisitDatePrecision | 'none') =>
  date && precision !== 'none' ? formatVisitDate(date, precision) : null;

const toLivedCity = (row: LivedCityRow): LivedCity => ({
  cityId: row.city_id,
  isCurrent: row.is_current,
  from: formatted(row.from_date, row.from_precision),
  to: formatted(row.to_date, row.to_precision),
});

export function createLivedCityStore(sql: Sql): LivedCityStore {
  const columns = sql`city_id, is_current, from_date::text AS from_date, from_precision,
    to_date::text AS to_date, to_precision`;

  return {
    cityExists: (cityId) => cityExists(sql, cityId),

    async list(userId, { afterCityId, limit }) {
      const rows = await sql<LivedCityRow[]>`
        SELECT ${columns} FROM lived_cities
        WHERE user_id = ${userId}
          ${afterCityId === undefined ? sql`` : sql`AND city_id > ${afterCityId}`}
        ORDER BY city_id
        LIMIT ${limit}`;
      return rows.map(toLivedCity);
    },

    async set(userId, cityId, { isCurrent, from, to }) {
      return sql.begin(async (tx) => {
        if (isCurrent) {
          // Two requests must not both make their city the current one.
          await tx`SELECT pg_advisory_xact_lock(${userId}, 0)`;
          await tx`
            UPDATE lived_cities SET is_current = false
            WHERE user_id = ${userId} AND is_current AND city_id <> ${cityId}`;
        }
        // A lived-in city counts as visited, so it cannot stay planned (BR-004).
        await leavePlannedList(tx, userId, cityId);
        const [row] = await tx<LivedCityRow[]>`
          INSERT INTO lived_cities
            (user_id, city_id, is_current, from_date, from_precision, to_date, to_precision)
          VALUES (${userId}, ${cityId}, ${isCurrent},
            ${from?.start ?? null}, ${from?.precision ?? 'none'}::visit_date_precision,
            ${to?.start ?? null}, ${to?.precision ?? 'none'}::visit_date_precision)
          ON CONFLICT (user_id, city_id) DO UPDATE SET
            is_current = EXCLUDED.is_current,
            from_date = EXCLUDED.from_date, from_precision = EXCLUDED.from_precision,
            to_date = EXCLUDED.to_date, to_precision = EXCLUDED.to_precision
          RETURNING ${columns}`;
        if (!row) throw new Error('Lived-in city could not be saved');
        return toLivedCity(row);
      });
    },

    async remove(userId, cityId, confirmRatingDeletion) {
      return unlessRatingNeedsConfirmation(() =>
        sql.begin(async (tx): Promise<RemovalResult> => {
          await lockDefaultLists(tx, userId, cityId);
          const deleted = await tx`
            DELETE FROM lived_cities WHERE user_id = ${userId} AND city_id = ${cityId}
            RETURNING city_id`;
          if (deleted.length === 0) return 'not_found';
          await dropRatingIfNotVisited(tx, userId, cityId, confirmRatingDeletion);
          return 'removed';
        }),
      );
    },
  };
}

/** For places that never reach the lived-in cities, such as writing the OpenAPI document. */
export const noLivedCityStore = new Proxy({} as LivedCityStore, {
  get: () => () => {
    throw new Error('Lived-in cities are not available here');
  },
});
