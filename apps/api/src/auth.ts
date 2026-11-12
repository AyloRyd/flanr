import type { CurrentUser, UserRole } from '@flanr/shared';
import type { MiddlewareHandler } from 'hono';
import { problem } from './problem.ts';

/** Returns the Clerk user ID the session token belongs to, or null if the token is not valid. */
export type TokenVerifier = (token: string) => Promise<string | null>;

/** Returns Flanr's user for a Clerk user ID, creating it on the first request. */
export type UserResolver = (authProviderId: string) => Promise<CurrentUser>;

export interface AuthEnv {
  Variables: { user: CurrentUser };
}

function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return match?.[1] ?? null;
}

/**
 * Verifies the Clerk session token of the request (SRS 6.2) and makes the user available
 * to the handlers. Requests without a valid token get a 401.
 */
export function requireAuth(
  verifyToken: TokenVerifier,
  resolveUser: UserResolver,
): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const token = bearerToken(c.req.header('Authorization'));
    const authProviderId = token ? await verifyToken(token) : null;
    if (!authProviderId) {
      c.header('WWW-Authenticate', 'Bearer');
      return problem(c, 401, 'Authentication required', 'Send a valid session token.');
    }
    c.set('user', await resolveUser(authProviderId));
    await next();
  };
}

/** Lets the request through only if the user has one of the roles (FR-AUTH-010). Use after requireAuth. */
export function requireRole(...roles: UserRole[]): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const allowed = c.get('user').roles.some((role) => roles.includes(role));
    if (!allowed) {
      return problem(c, 403, 'Not allowed', 'Your account does not have the required role.');
    }
    await next();
  };
}
