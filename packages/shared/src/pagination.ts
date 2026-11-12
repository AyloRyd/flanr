import { z } from 'zod';

export const defaultPageSize = 20;
export const maxPageSize = 100;

/** Query parameters of every list endpoint (SRS 6.2). */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(maxPageSize).default(defaultPageSize),
  /** Opaque position returned as `nextCursor` by the previous page. */
  cursor: z.string().min(1).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Response of a list endpoint: one page of items and where the next page starts. */
export function paginated<Item extends z.ZodType>(item: Item) {
  return z.object({
    items: z.array(item),
    /** Null on the last page. */
    nextCursor: z.string().nullable(),
  });
}

/**
 * Cuts a page out of rows that were queried with one row more than the page size,
 * which is how a list knows whether another page exists without counting.
 */
export function toPage<Row>(rows: Row[], limit: number, cursorOf: (row: Row) => string) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > limit && last ? cursorOf(last) : null };
}
