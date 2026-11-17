import { test as base, expect, type Page } from '@playwright/test';

/** Waits until React has hydrated the page, see components/hydration-marker.tsx. */
export async function waitForHydration(page: Page): Promise<void> {
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
}

/**
 * Playwright's test, with a page that waits for hydration after every goto and reload.
 * Without that, a test can click a button before React handles clicks, and nothing happens.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);
    page.goto = async (...args) => {
      const response = await goto(...args);
      await waitForHydration(page);
      return response;
    };
    page.reload = async (...args) => {
      const response = await reload(...args);
      await waitForHydration(page);
      return response;
    };
    await provide(page);
  },
});

export { expect };
