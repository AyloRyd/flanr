import {
  formatVisitDate,
  type ParsedVisitDate,
  type Visit,
  type VisitDatePrecision,
} from '@flanr/shared';
import type { TransactionSql } from 'postgres';
import { cityExists } from './cities.ts';
import type { Sql } from './db.ts';

/** The date of a visit as it is stored. `date` is null for an undated visit. */
export interface VisitDates {
  date: ParsedVisitDate | null;
  beforeRegistration: boolean;
}

export interface VisitListOptions {
  cityId?: number | undefined;
  /** Returns visits with a smaller ID than this one, for the next page. */
  beforeId?: number | undefined;
  limit: number;
}

/**
 * Reads and changes visits. Every method takes the user and only ever touches that user's
 * visits, so a handler cannot reach someone else's by ID (NFR-SEC-003).
 */
export interface VisitStore {
  cityExists(cityId: number): Promise<boolean>;
  create(userId: number, cityId: number, dates: VisitDates): Promise<Visit>;
  /** Newest first. */
  list(userId: number, options: VisitListOptions): Promise<Visit[]>;
  find(userId: number, visitId: number): Promise<Visit | null>;
  update(userId: number, visitId: number, dates: VisitDates): Promise<Visit | null>;
  remove(userId: number, visitId: number): Promise<boolean>;
  countUndated(userId: number, cityId: number): Promise<number>;
  /** Adds or removes undated visits until the user has `count` of them in the city (FR-VIS-005). */
  setUndatedCount(userId: number, cityId: number, count: number): Promise<void>;
}

interface VisitRow {
  id: number;
  city_id: number;
  date: string | null;
  date_precision: VisitDatePrecision | 'none';
  before_registration: boolean;
  created_at: Date;
}

const toVisit = (row: VisitRow): Visit => ({
  id: row.id,
  cityId: row.city_id,
  date:
    row.date && row.date_precision !== 'none'
      ? formatVisitDate(row.date, row.date_precision)
      : null,
  datePrecision: row.date_precision,
  beforeRegistration: row.before_registration,
  createdAt: row.created_at.toISOString(),
});

export function createVisitStore(sql: Sql): VisitStore {
  const columns = sql`id, city_id, date::text AS date, date_precision, before_registration, created_at`;
  const stored = (dates: VisitDates) => ({
    date: dates.date?.start ?? null,
    precision: dates.date?.precision ?? 'none',
  });

  return {
    cityExists: (cityId) => cityExists(sql, cityId),

    async create(userId, cityId, dates) {
      const { date, precision } = stored(dates);
      const [row] = await sql<VisitRow[]>`
        INSERT INTO visits (user_id, city_id, date, date_precision, before_registration)
        VALUES (${userId}, ${cityId}, ${date}, ${precision}::visit_date_precision, ${dates.beforeRegistration})
        RETURNING ${columns}`;
      if (!row) throw new Error('Visit could not be created');
      return toVisit(row);
    },

    async list(userId, { cityId, beforeId, limit }) {
      const rows = await sql<VisitRow[]>`
        SELECT ${columns} FROM visits
        WHERE user_id = ${userId}
          ${cityId === undefined ? sql`` : sql`AND city_id = ${cityId}`}
          ${beforeId === undefined ? sql`` : sql`AND id < ${beforeId}`}
        ORDER BY id DESC
        LIMIT ${limit}`;
      return rows.map(toVisit);
    },

    async find(userId, visitId) {
      const [row] = await sql<VisitRow[]>`
        SELECT ${columns} FROM visits WHERE id = ${visitId} AND user_id = ${userId}`;
      return row ? toVisit(row) : null;
    },

    async update(userId, visitId, dates) {
      const { date, precision } = stored(dates);
      const [row] = await sql<VisitRow[]>`
        UPDATE visits
        SET date = ${date}, date_precision = ${precision}::visit_date_precision,
            before_registration = ${dates.beforeRegistration}
        WHERE id = ${visitId} AND user_id = ${userId}
        RETURNING ${columns}`;
      return row ? toVisit(row) : null;
    },

    async remove(userId, visitId) {
      const rows = await sql`
        DELETE FROM visits WHERE id = ${visitId} AND user_id = ${userId} RETURNING id`;
      return rows.length > 0;
    },

    async countUndated(userId, cityId) {
      return countUndated(sql, userId, cityId);
    },

    async setUndatedCount(userId, cityId, count) {
      await sql.begin(async (tx) => {
        // Two requests for the same user and city must not both add or both remove visits.
        await tx`SELECT pg_advisory_xact_lock(${userId}, ${cityId})`;
        const current = await countUndated(tx, userId, cityId);
        if (count > current) {
          await tx`
            INSERT INTO visits (user_id, city_id, date_precision, before_registration)
            SELECT ${userId}, ${cityId}, 'none', true FROM generate_series(1, ${count - current})`;
        } else if (count < current) {
          await tx`
            DELETE FROM visits WHERE id IN (
              SELECT id FROM visits
              WHERE user_id = ${userId} AND city_id = ${cityId} AND date_precision = 'none'
              ORDER BY id DESC
              LIMIT ${current - count}
            )`;
        }
      });
    },
  };
}

async function countUndated(
  sql: Sql | TransactionSql,
  userId: number,
  cityId: number,
): Promise<number> {
  const [row] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM visits
    WHERE user_id = ${userId} AND city_id = ${cityId} AND date_precision = 'none'`;
  return row?.count ?? 0;
}

/** For places that never reach the visits, such as writing the OpenAPI document. */
export const noVisitStore = new Proxy({} as VisitStore, {
  get: () => () => {
    throw new Error('Visits are not available here');
  },
});
