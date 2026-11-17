import { clerk } from '@clerk/testing/playwright';
import type { Page } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { expect, test } from './test';

const onboarding = en.onboarding;

/** Finds a city in the onboarding search and adds it. */
async function addCity(page: Page, search: string, city: string) {
  await page.getByRole('searchbox', { name: onboarding.searchLabel }).fill(search);
  await page
    .getByRole('list', { name: onboarding.found })
    .getByRole('button', { name: onboarding.add.replace('{city}', city) })
    .click();
}

test('a new user adds three past cities with their numbers of visits (FR-VIS-007)', async ({
  page,
  freshUser,
}) => {
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: freshUser.emailAddress });
  await clerk.loaded({ page });

  // An empty Visited list offers the onboarding.
  await page.goto('/me');
  await page.getByRole('link', { name: 'Add the cities you have been to' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(onboarding.title);

  await addCity(page, 'Cologne', 'Köln');
  await addCity(page, 'Bonn', 'Bonn');
  await addCity(page, 'Aachen', 'Aachen');
  await page
    .getByRole('spinbutton', { name: onboarding.countOf.replace('{city}', 'Bonn') })
    .fill('3');
  await page
    .getByRole('spinbutton', { name: onboarding.countOf.replace('{city}', 'Aachen') })
    .fill('2');
  await page
    .getByRole('textbox', { name: onboarding.dateOf.replace('{city}', 'Aachen') })
    .fill('2019-07');

  // Visits without a date need the confirmation (FR-VIS-003).
  await page.getByRole('button', { name: 'Save 3 cities' }).click();
  await expect(page.getByText(onboarding.problem.confirm)).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Save 3 cities' }).click();

  const visited = page.getByRole('list', { name: en.profile.visited });
  await expect(visited).toBeVisible({ timeout: 15_000 });
  await expect(visited.getByRole('listitem').filter({ hasText: 'Köln' })).toContainText('1 visit');
  await expect(visited.getByRole('listitem').filter({ hasText: 'Bonn' })).toContainText('3 visits');
  await expect(visited.getByRole('listitem').filter({ hasText: 'Aachen' })).toContainText(
    '2 visits',
  );
});
