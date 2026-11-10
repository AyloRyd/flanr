import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.ts';

describe('healthResponseSchema', () => {
  it('accepts a healthy response', () => {
    expect(healthResponseSchema.parse({ status: 'ok', database: 'ok' })).toEqual({
      status: 'ok',
      database: 'ok',
    });
  });

  it('rejects an unknown status', () => {
    expect(healthResponseSchema.safeParse({ status: 'broken', database: 'ok' }).success).toBe(
      false,
    );
  });
});
