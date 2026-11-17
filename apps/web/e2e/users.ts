import { clerk } from '@clerk/testing/playwright';
import type { Page, TestInfo } from '@playwright/test';

/** The Playwright projects; each gets its own test user. */
export const projectNames = ['desktop', 'mobile'] as const;

export type TestUsers = Partial<Record<string, { id: string; emailAddress: string }>>;

export const testUsersVariable = 'E2E_USERS';

/**
 * What a test user is for. Signing out happens in a browser of its own user, so that it can
 * never end a session that other tests of the project are using at the same time.
 */
export type TestUserPurpose = 'main' | 'signOut';

/** The key of a test user in the environment: the project, and the purpose unless it is main. */
export const testUserKey = (project: string, purpose: TestUserPurpose = 'main') =>
  purpose === 'main' ? project : `${project}:${purpose}`;

/** The users that the global setup created, by project. */
export function testUsers(): TestUsers {
  const value = process.env[testUsersVariable];
  return value ? (JSON.parse(value) as TestUsers) : {};
}

/** Signs in a test user of the running project on the current page. */
export async function signInTestUser(
  page: Page,
  testInfo: TestInfo,
  purpose: TestUserPurpose = 'main',
): Promise<void> {
  const user = testUsers()[testUserKey(testInfo.project.name, purpose)];
  if (!user)
    throw new Error(`The global setup has not created a user for ${testInfo.project.name}`);
  await clerk.signIn({ page, emailAddress: user.emailAddress });
}

/** The API of the end-to-end tests, as the browser reaches it. */
export const e2eApiUrl = 'http://localhost:8788';

/**
 * Calls the test API as the signed-in user of the page, with the session token of Clerk in the
 * browser. Used to put the user's data into a known state and to read it back.
 */
export async function fetchApiAsUser(
  page: Page,
  method: 'GET' | 'PUT' | 'DELETE' | 'POST',
  path: string,
  body?: unknown,
): Promise<Response> {
  const token = await page.evaluate(() => window.Clerk.session?.getToken());
  if (!token) throw new Error('No signed-in user on the page');
  return fetch(`${e2eApiUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Like fetchApiAsUser, for calls where only the status matters. */
export async function callApiAsUser(
  page: Page,
  method: 'GET' | 'PUT' | 'DELETE' | 'POST',
  path: string,
  body?: unknown,
): Promise<number> {
  return (await fetchApiAsUser(page, method, path, body)).status;
}
