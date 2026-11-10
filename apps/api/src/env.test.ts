import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.ts';

describe('loadEnv', () => {
  it('uses the default port when API_PORT is not set', () => {
    expect(loadEnv({ DATABASE_URL: 'postgres://u:p@localhost:5433/db' }).API_PORT).toBe(8787);
  });

  it('fails when DATABASE_URL is missing', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });
});
