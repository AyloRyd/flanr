import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { signInTestUser } from './users';

const signInButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: en.auth.signIn });

test('a guest sees the sign-in button and reaches the sign-in form (FR-AUTH-001)', async ({
  page,
}) => {
  await setupClerkTestingToken({ page });
  await page.goto('/');
  // The button only works once Clerk has loaded in the browser.
  await clerk.loaded({ page });

  await signInButton(page).click();

  // The first visit of the sign-in page compiles it on the development server.
  await expect(page).toHaveURL(/\/sign-in/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  await expect(page.getByLabel(/email address/i)).toBeVisible();
});

test('the sign-up page shows the sign-up form', async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto('/sign-up');

  await expect(page).toHaveTitle(`${en.auth.signUpTitle} · ${en.app.name}`);
  await expect(page.getByLabel(/email address/i)).toBeVisible();
});

test('a user signs in, sees the account menu and signs out (FR-AUTH-007)', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await signInTestUser(page, testInfo);
  await page.reload();

  // The server renders the signed-in header, so the session reached the proxy too.
  await expect(signInButton(page)).toBeHidden();
  const userButton = page.getByRole('button', { name: /open user menu/i });
  await expect(userButton).toBeVisible();

  await userButton.click();
  // The menu also has "Manage account", where the email address is changed (FR-AUTH-008).
  await expect(page.getByRole('button', { name: /manage account/i })).toBeVisible();
  await page.getByRole('button', { name: /^sign out$/i }).click();

  await expect(signInButton(page)).toBeVisible();
  await page.reload();
  await expect(signInButton(page)).toBeVisible();
});
