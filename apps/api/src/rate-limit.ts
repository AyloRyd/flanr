import type { MiddlewareHandler } from 'hono';
import type { AuthEnv } from './auth.ts';
import { problem } from './problem.ts';

export interface RateLimitOptions {
  /** Requests allowed per window and client. */
  limit: number;
  windowMs: number;
  now?: () => number;
}

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Limits write requests per client (NFR-SEC-004). The counters live in memory, which is enough
 * while the API runs as one process; several instances would need a shared store.
 */
export function rateLimitWrites({
  limit,
  windowMs,
  now = Date.now,
}: RateLimitOptions): MiddlewareHandler<AuthEnv> {
  const windows = new Map<string, { startedAt: number; count: number }>();

  return async (c, next) => {
    if (safeMethods.has(c.req.method)) return next();

    const user = c.get('user') as AuthEnv['Variables']['user'] | undefined;
    const client = user
      ? `user:${user.id}`
      : `ip:${c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown'}`;
    const time = now();
    const current = windows.get(client);
    const window =
      current && time - current.startedAt < windowMs ? current : { startedAt: time, count: 0 };
    window.count += 1;
    windows.set(client, window);

    if (window.count > limit) {
      const retryAfter = Math.ceil((window.startedAt + windowMs - time) / 1000);
      c.header('Retry-After', String(retryAfter));
      return problem(c, 429, 'Too many requests', `Try again in ${retryAfter} seconds.`);
    }
    // Finished windows of other clients are dropped now and then, so the map does not grow forever.
    if (windows.size > 10_000) {
      for (const [key, value] of windows) {
        if (time - value.startedAt >= windowMs) windows.delete(key);
      }
    }
    await next();
  };
}
