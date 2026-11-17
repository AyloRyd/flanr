import { clerk } from '@clerk/testing/playwright';
import { expect, test, type Page } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { e2eCities } from './database';
import { callApiAsUser, signInTestUser } from './users';

const planButton = (page: Page) => page.getByRole('button', { name: en.city.plan });
const plannedButton = (page: Page) => page.getByRole('button', { name: en.city.planned });

test('a guest who saves a city is asked to sign in and comes back (FR-AUTH-002)', async ({
  page,
}) => {
  await page.goto(`/cities/${e2eCities.worringen}`);
  await clerk.loaded({ page });

  await planButton(page).click();

  const dialog = page.getByRole('dialog', { name: en.city.signInPrompt.planTitle });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: en.city.signInPrompt.signUp })).toBeVisible();
  await dialog.getByRole('button', { name: en.city.signInPrompt.signIn }).click();

  // Clerk sends the user back to the city page after signing in. It keeps the address as
  // redirect_url, at first in the fragment of the sign-in URL (/sign-in#/?redirect_url=…), which
  // it sometimes drops once its form has loaded. The links of its form keep it, so the test
  // reads it from there.
  await expect(page).toHaveURL(/\/sign-in/, { timeout: 15_000 });
  const clerkLink = page.locator('a[href*="redirect_url="]').first();
  await expect(clerkLink).toBeAttached({ timeout: 15_000 });
  const href = new URL((await clerkLink.getAttribute('href')) ?? '', page.url());
  const fragment = href.hash.replace(/^#\/?\??/, '');
  const returnUrl =
    href.searchParams.get('redirect_url') ?? new URLSearchParams(fragment).get('redirect_url');
  expect(returnUrl).toMatch(new RegExp(`/cities/${e2eCities.worringen}$`));
});

test.describe('signed in', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto('/');
    await signInTestUser(page, testInfo);
  });

  test('a user plans a city and removes it again (FR-LIST-002)', async ({ page }, testInfo) => {
    // With --repeat-each, two runs of this test can toggle the same user's Planned list at the
    // same time; each run gets a city of its own. Neither city is ever visited.
    const plannable = [e2eCities.worringen, e2eCities.point];
    const city = plannable[testInfo.repeatEachIndex % plannable.length];
    // Start from a known state: the city is not planned.
    await callApiAsUser(page, 'DELETE', `/v1/planned-cities/${city}`);
    await page.goto(`/cities/${city}`);

    await planButton(page).click();
    await expect(plannedButton(page)).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(plannedButton(page)).toBeVisible();

    await plannedButton(page).click();
    await expect(planButton(page)).toHaveAttribute('aria-pressed', 'false');
    await page.reload();
    await expect(planButton(page)).toBeVisible();
  });

  test('the city page shows two visits and the rating 8 (FR-CITY-004)', async ({ page }) => {
    const city = e2eCities.ownData;
    expect(
      await callApiAsUser(page, 'PUT', `/v1/cities/${city}/undated-visits`, {
        count: 2,
        beforeRegistration: true,
      }),
    ).toBe(200);
    expect(await callApiAsUser(page, 'PUT', `/v1/cities/${city}/rating`, { subjective: 8 })).toBe(
      200,
    );

    await page.goto(`/cities/${city}`);

    const own = page.getByRole('region', { name: en.city.yours });
    await expect(own.getByText('2 visits', { exact: true })).toBeVisible();
    await expect(own.getByText('2 visits without a date')).toBeVisible();
    await expect(own.getByText('8', { exact: true })).toBeVisible();
    // A visited city cannot be planned (FR-LIST-002, BR-004).
    await expect(planButton(page)).toHaveCount(0);
  });

  test('a guest does not see the own data of anyone', async ({ browser }) => {
    const guestPage = await browser.newPage();
    await guestPage.goto(`/cities/${e2eCities.cologne}`);

    await expect(guestPage.getByRole('heading', { level: 1 })).toHaveText('Köln');
    await expect(guestPage.getByRole('region', { name: en.city.yours })).toHaveCount(0);
    await guestPage.close();
  });
});
