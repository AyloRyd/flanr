import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Error response in RFC 9457 Problem Details format. */
export function problem(c: Context, status: ContentfulStatusCode, title: string, detail?: string) {
  return c.json({ type: 'about:blank', title, status, ...(detail ? { detail } : {}) }, status, {
    'Content-Type': 'application/problem+json',
  });
}
