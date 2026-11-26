import { test as base, expect, type Page } from '@playwright/test';
import { createFreshUser, deleteClerkUser, type ClerkTestUser } from './fresh-user';

/** Waits until React has hydrated the page, see components/hydration-marker.tsx. */
export async function waitForHydration(page: Page): Promise<void> {
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
}

/**
 * Playwright's test, with a page that waits for hydration after every goto and reload.
 * Without that, a test can click a button before React handles clicks, and nothing happens.
 */
export const test = base.extend<{ freshUser: ClerkTestUser }>({
  /** A Clerk user of the test's own, deleted after it; see fresh-user.ts. */
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure.
  freshUser: async ({}, provide) => {
    const user = await createFreshUser();
    await provide(user);
    await deleteClerkUser(user.id);
  },

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

/**
 * Chooses an item of Clerk's account menu. Clerk renders the menu again while it settles, so an
 * item can leave the page under the click; the menu is then opened and the item clicked again.
 */
export async function chooseFromAccountMenu(page: Page, item: string): Promise<void> {
  const menuButton = page.getByRole('button', { name: /open user menu/i });
  const entry = page.getByRole('button', { name: item });
  await expect(async () => {
    if (!(await entry.isVisible())) await menuButton.click();
    await entry.click({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}
