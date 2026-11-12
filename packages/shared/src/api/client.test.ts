import { describe, expect, it } from 'vitest';
import { createApiClient } from './client.ts';

const user = { id: 1, username: 'ada', displayName: 'Ada', avatarUrl: null, roles: ['user'] };

function respondWith(status: number, body: unknown, contentType = 'application/json') {
  const requests: Request[] = [];
  const fetch = async (request: Request) => {
    requests.push(request);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': contentType },
    });
  };
  return { fetch, requests };
}

describe('API client (CON-009)', () => {
  it('requests the path under the base URL and returns the typed body', async () => {
    const { fetch, requests } = respondWith(200, user);
    const api = createApiClient({ baseUrl: 'http://api.test', fetch });

    const { data, error } = await api.GET('/v1/me');

    expect(requests[0]?.url).toBe('http://api.test/v1/me');
    expect(data?.username).toBe('ada');
    expect(error).toBeUndefined();
  });

  it('sends the session token of a signed-in user', async () => {
    const { fetch, requests } = respondWith(200, user);
    const api = createApiClient({
      baseUrl: 'http://api.test',
      fetch,
      getToken: async () => 'session-token',
    });

    await api.GET('/v1/me');

    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer session-token');
  });

  it('sends no Authorization header for a guest', async () => {
    const { fetch, requests } = respondWith(200, { status: 'ok', database: 'ok' });
    const api = createApiClient({ baseUrl: 'http://api.test', fetch, getToken: async () => null });

    await api.GET('/health');

    expect(requests[0]?.headers.has('Authorization')).toBe(false);
  });

  it('returns the Problem Details body of a failed request as the error', async () => {
    const problem = { type: 'about:blank', title: 'Unauthorized', status: 401 };
    const { fetch } = respondWith(401, problem, 'application/problem+json');
    const api = createApiClient({ baseUrl: 'http://api.test', fetch });

    const { data, error, response } = await api.GET('/v1/me');

    expect(response.status).toBe(401);
    expect(data).toBeUndefined();
    expect(error?.title).toBe('Unauthorized');
  });
});
