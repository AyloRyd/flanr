import { expect, test } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };

test('home page shows the app name', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(en.app.name);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.app.name);
});
