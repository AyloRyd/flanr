import { describe, expect, it } from 'vitest';
import { maxPageSize, paginationQuerySchema, toPage } from './pagination.ts';

describe('pagination (SRS 6.2)', () => {
  it('uses the default page size and accepts a page size from the query string', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(paginationQuerySchema.parse({ limit: '50', cursor: 'abc' })).toEqual({
      limit: 50,
      cursor: 'abc',
    });
  });

  it('rejects a page size above the maximum', () => {
    expect(paginationQuerySchema.safeParse({ limit: maxPageSize + 1 }).success).toBe(false);
  });

  it('returns a cursor only when another page exists', () => {
    const cursorOf = (row: number) => String(row);

    expect(toPage([1, 2, 3], 2, cursorOf)).toEqual({ items: [1, 2], nextCursor: '2' });
    expect(toPage([1, 2], 2, cursorOf)).toEqual({ items: [1, 2], nextCursor: null });
    expect(toPage([], 2, cursorOf)).toEqual({ items: [], nextCursor: null });
  });
});
