import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.ts';

describe('loadEnv', () => {
  it('uses the default port when API_PORT is not set', () => {
    expect(loadEnv({ DATABASE_URL: 'postgres://u:p@localhost:5433/db' }).API_PORT).toBe(8787);
  });

  it('allows 60 writes per minute unless WRITE_RATE_LIMIT is set (NFR-SEC-004)', () => {
    const base = { DATABASE_URL: 'postgres://u:p@localhost:5433/db' };
    expect(loadEnv(base).WRITE_RATE_LIMIT).toBe(60);
    expect(loadEnv({ ...base, WRITE_RATE_LIMIT: '10000' }).WRITE_RATE_LIMIT).toBe(10000);
    expect(() => loadEnv({ ...base, WRITE_RATE_LIMIT: '0' })).toThrow(/WRITE_RATE_LIMIT/);
  });

  it('fails when DATABASE_URL is missing', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });
});
