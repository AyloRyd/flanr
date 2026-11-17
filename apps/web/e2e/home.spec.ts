import en from '../messages/en.json' with { type: 'json' };
import { expect, test } from './test';

test('home page shows the app name and the lead text', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(en.app.name);
  await expect(page.getByRole('link', { name: en.app.name })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.home.title);
});

test('the theme can be switched to dark and back to light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const html = page.locator('html');

  await page.getByRole('button', { name: en.theme.label }).click();
  await page.getByRole('menuitemradio', { name: en.theme.dark }).click();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.getByRole('button', { name: en.theme.label }).click();
  await page.getByRole('menuitemradio', { name: en.theme.light }).click();
  await expect(html).not.toHaveClass(/\bdark\b/);
});

test('follows the dark system theme until the user picks one', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
});

test('an unknown address shows the not-found page with a way home', async ({ page }) => {
  const response = await page.goto('/no-such-page');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.notFound.title);
  await page.getByRole('link', { name: en.notFound.backHome }).click();
  await expect(page).toHaveURL('/');
});

test('the page does not scroll sideways on a 360 px screen (NFR-UX-001)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
