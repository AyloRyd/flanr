import { healthResponseSchema } from '@flanr/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';

describe('GET /health', () => {
  it('returns 200 when the database is reachable', async () => {
    const app = createApp({ checkDatabase: async () => true });

    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toEqual({
      status: 'ok',
      database: 'ok',
    });
  });

  it('returns 503 when the database is not reachable', async () => {
    const app = createApp({ checkDatabase: async () => false });

    const response = await app.request('/health');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable', database: 'unavailable' });
  });
});
