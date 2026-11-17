import { clerk } from '@clerk/testing/playwright';
import type { Page } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { e2eCities } from './database';
import { expect, test } from './test';
import { callApiAsUser, signInTestUser } from './users';

const lived = en.city.lived;
const names = [
  ['Frechen', 'Pulheim'],
  ['Wesseling', 'Dormagen'],
];

/** The two cities of the running repetition, and their names. */
let cities: readonly [number, number];
let cityNames: string[];

const ownData = (page: Page) => page.getByRole('region', { name: en.city.yours });

/** Opens the lived-in dialog of the city page that is open. */
async function openLivedDialog(page: Page, cityName: string) {
  await ownData(page)
    .getByRole('button', { name: new RegExp(`${lived.mark}|${lived.change}`) })
    .click();
  return page.getByRole('dialog', { name: lived.title.replace('{city}', cityName) });
}

test.beforeEach(async ({ page }, testInfo) => {
  const index = testInfo.repeatEachIndex % e2eCities.lived.length;
  cities = e2eCities.lived[index] ?? e2eCities.lived[0];
  cityNames = names[index] ?? [];
  await page.goto('/');
  await signInTestUser(page, testInfo);
  await clerk.loaded({ page });
  // Start from nothing: no mark and no rating.
  for (const city of cities) {
    await callApiAsUser(page, 'DELETE', `/v1/lived-cities/${city}?confirmRatingDeletion=true`);
    await callApiAsUser(page, 'DELETE', `/v1/cities/${city}/rating`);
  }
});

test('a city without visits marked as home is visited and can be rated (FR-VIS-010)', async ({
  page,
}) => {
  await page.goto(`/cities/${cities[0]}`);
  await expect(page.getByRole('button', { name: en.city.plan })).toBeVisible();

  const dialog = await openLivedDialog(page, cityNames[0] ?? '');
  await dialog.getByRole('radio', { name: lived.current }).check();
  await dialog.getByRole('button', { name: lived.save }).click();

  await expect(dialog).toBeHidden();
  await expect(ownData(page).getByText(en.city.livedHere, { exact: true })).toBeVisible();
  // A lived-in city is in the Visited list (BR-004) and can be rated (BR-005).
  await expect(page.getByRole('button', { name: en.city.plan })).toHaveCount(0);
  await expect(ownData(page).getByRole('button', { name: en.city.rate })).toBeVisible();
});

test('a new home makes the previous one a past lived-in city (FR-VIS-010)', async ({ page }) => {
  for (const city of cities) {
    expect(await callApiAsUser(page, 'PUT', `/v1/lived-cities/${city}`, { isCurrent: true })).toBe(
      200,
    );
  }

  await page.goto(`/cities/${cities[0]}`);
  await expect(ownData(page).getByText(en.city.livedHerePast, { exact: true })).toBeVisible();
  await page.goto(`/cities/${cities[1]}`);
  await expect(ownData(page).getByText(en.city.livedHere, { exact: true })).toBeVisible();
});

test('a past lived-in city has a period that must not end before it starts (BR-016)', async ({
  page,
}) => {
  await page.goto(`/cities/${cities[0]}`);
  const dialog = await openLivedDialog(page, cityNames[0] ?? '');
  await dialog.getByRole('radio', { name: lived.past }).check();
  await dialog.getByRole('textbox', { name: lived.from }).fill('2018');
  await dialog.getByRole('textbox', { name: lived.to }).fill('2015-06');
  await dialog.getByRole('button', { name: lived.save }).click();
  await expect(dialog.getByRole('alert')).toHaveText(lived.problem.to_before_from);

  await dialog.getByRole('textbox', { name: lived.from }).fill('2015');
  await dialog.getByRole('textbox', { name: lived.to }).fill('2018');
  await dialog.getByRole('button', { name: lived.save }).click();

  await expect(ownData(page).getByText(`${en.city.livedHerePast}, 2015 – 2018`)).toBeVisible();
});

test('removing the mark of a rated city without visits deletes the rating too (BR-005)', async ({
  page,
}) => {
  expect(
    await callApiAsUser(page, 'PUT', `/v1/lived-cities/${cities[0]}`, { isCurrent: false }),
  ).toBe(200);
  expect(
    await callApiAsUser(page, 'PUT', `/v1/cities/${cities[0]}/rating`, { subjective: 8 }),
  ).toBe(200);
  await page.goto(`/cities/${cities[0]}`);

  const dialog = await openLivedDialog(page, cityNames[0] ?? '');
  await dialog.getByRole('button', { name: lived.remove }).click();
  const confirm = page.getByRole('alertdialog', { name: lived.removeTitle });
  await expect(confirm).toContainText(lived.removeWithRating);
  await confirm.getByRole('button', { name: lived.removeAndRating }).click();

  await expect(ownData(page).getByText(en.city.notRatedByYou)).toBeVisible();
  await expect(page.getByRole('button', { name: en.city.plan })).toBeVisible();
  expect(await callApiAsUser(page, 'GET', `/v1/cities/${cities[0]}/rating`)).toBe(404);
});
