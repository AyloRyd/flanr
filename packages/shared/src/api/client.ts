import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { paths } from './schema.ts';

export interface ApiClientOptions {
  /** Where the API is served, for example http://localhost:3001. */
  baseUrl: string;
  /** Returns the session token of the signed-in user, or null for a guest. */
  getToken?: () => Promise<string | null>;
  /** Replaces the global fetch, for example in tests. */
  fetch?: (request: Request) => Promise<Response>;
}

/**
 * Client for the Flanr API with the paths, parameters and responses typed from the OpenAPI
 * document (CON-009, NFR-PORT-001): `const { data, error } = await api.GET('/v1/me')`.
 * `error` is the Problem Details body of a failed request.
 */
export type ApiClient = Client<paths>;

export function createApiClient(options: ApiClientOptions): ApiClient {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  if (options.getToken) client.use(bearerToken(options.getToken));
  return client;
}

function bearerToken(getToken: () => Promise<string | null>): Middleware {
  return {
    async onRequest({ request }) {
      const token = await getToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
  };
}
