import type { CurrentUser, UserRole } from '@flanr/shared';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { requireAuth, requireRole, type AuthEnv } from './auth.ts';
import { rateLimitWrites } from './rate-limit.ts';

const userWith = (roles: UserRole[]): CurrentUser => ({
  id: 7,
  username: 'ada',
  displayName: 'Ada',
  avatarUrl: null,
  bio: null,
  homeCityId: null,
  homeCityVisible: false,
  profileVisibility: 'public' as const,
  visitedVisibility: 'public' as const,
  plannedVisibility: 'public' as const,
  roles,
  registeredAt: '2026-03-01T12:00:00.000Z',
});

function appFor(roles: UserRole[]) {
  const app = new Hono<AuthEnv>();
  app.use(
    requireAuth(
      async () => 'clerk_7',
      async () => userWith(roles),
    ),
  );
  app.post('/roles', requireRole('administrator'), (c) => c.body(null, 204));
  return app;
}

const signedIn = { method: 'POST', headers: { Authorization: 'Bearer token' } };

describe('requireRole (FR-AUTH-010)', () => {
  it('rejects a registered user who tries an administrator action', async () => {
    const response = await appFor(['user']).request('/roles', signedIn);

    expect(response.status).toBe(403);
    expect(response.headers.get('Content-Type')).toBe('application/problem+json');
  });

  it('lets an administrator through', async () => {
    const response = await appFor(['user', 'administrator']).request('/roles', signedIn);

    expect(response.status).toBe(204);
  });
});

describe('rateLimitWrites (NFR-SEC-004)', () => {
  function limitedApp(now: () => number) {
    const app = new Hono<AuthEnv>();
    app.use(rateLimitWrites({ limit: 2, windowMs: 60_000, now }));
    app.get('/things', (c) => c.body(null, 204));
    app.post('/things', (c) => c.body(null, 204));
    return app;
  }
  const post = (app: ReturnType<typeof limitedApp>, ip: string) =>
    app.request('/things', { method: 'POST', headers: { 'X-Forwarded-For': ip } });

  it('answers 429 with Retry-After once a client is over the limit', async () => {
    const app = limitedApp(() => 1_000);

    expect((await post(app, '10.0.0.1')).status).toBe(204);
    expect((await post(app, '10.0.0.1')).status).toBe(204);
    const blocked = await post(app, '10.0.0.1');

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('60');
    expect(blocked.headers.get('Content-Type')).toBe('application/problem+json');
  });

  it('counts each client separately and never limits reads', async () => {
    const app = limitedApp(() => 1_000);
    await post(app, '10.0.0.1');
    await post(app, '10.0.0.1');
    await post(app, '10.0.0.1');

    expect((await post(app, '10.0.0.2')).status).toBe(204);
    expect(
      (await app.request('/things', { headers: { 'X-Forwarded-For': '10.0.0.1' } })).status,
    ).toBe(204);
  });

  it('allows writes again when the window has passed', async () => {
    let time = 1_000;
    const app = limitedApp(() => time);
    await post(app, '10.0.0.1');
    await post(app, '10.0.0.1');
    await post(app, '10.0.0.1');

    time += 60_000;

    expect((await post(app, '10.0.0.1')).status).toBe(204);
  });
});
