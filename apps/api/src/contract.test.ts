import { readFile } from 'node:fs/promises';
import { createApiClient } from '@flanr/shared';
import { describe, expect, it } from 'vitest';
import { createApp, type AppDependencies } from './app.ts';

const user = {
  id: 1,
  username: 'ada',
  displayName: 'Ada',
  avatarUrl: null,
  roles: ['user' as const],
};

const dependencies: AppDependencies = {
  checkDatabase: async () => true,
  getCityTile: async () => null,
  corsOrigins: [],
  verifyToken: async (token) => (token === 'valid-token' ? 'clerk_1' : null),
  resolveUser: async () => user,
  readWebhook: async () => null,
  applyUserEvent: async () => {},
};

describe('API contract (CON-009, NFR-PORT-001)', () => {
  it('is the document the app serves; run `pnpm api:contract` if not', async () => {
    const contract = new URL('../../../packages/shared/openapi.json', import.meta.url);
    const response = await createApp(dependencies).request('/openapi.json');

    expect(JSON.parse(await readFile(contract, 'utf8'))).toEqual(await response.json());
  });
});

describe('Generated client against the app', () => {
  const app = createApp(dependencies);
  const clientFor = (token: string | null) =>
    createApiClient({
      baseUrl: 'http://api.test',
      fetch: async (request) => app.fetch(request),
      getToken: async () => token,
    });

  it('reads the signed-in user', async () => {
    const { data } = await clientFor('valid-token').GET('/v1/me');

    expect(data).toEqual(user);
  });

  it('gets a 401 in Problem Details format without a valid token', async () => {
    const { error, response } = await clientFor(null).GET('/v1/me');

    expect(response.status).toBe(401);
    expect(error).toMatchObject({ status: 401, title: expect.any(String) });
  });
});
