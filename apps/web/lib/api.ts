import { auth } from '@clerk/nextjs/server';
import { createApiClient, type ApiClient } from '@flanr/shared';

/** Where the API runs, as the web server reaches it. */
export const apiUrl = process.env.API_URL ?? 'http://localhost:8787';

/**
 * The API client for server components and server actions. It sends the Clerk session token of
 * the signed-in user, so the API answers for that user; for a guest it sends none. The web app
 * never reads the database itself.
 */
export function serverApi(): ApiClient {
  return createApiClient({
    baseUrl: apiUrl,
    getToken: async () => (await auth()).getToken(),
  });
}
