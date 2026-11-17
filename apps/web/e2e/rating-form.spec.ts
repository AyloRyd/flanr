import { clerk } from '@clerk/testing/playwright';
import type { CityRating } from '@flanr/shared';
import { expect, test, type Page } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { e2eCities } from './database';
import { callApiAsUser, fetchApiAsUser, signInTestUser } from './users';

const form = en.city.ratingForm;

const ownData = (page: Page) => page.getByRole('region', { name: en.city.yours });

/** Opens the rating form from the user's own data on the city page. */
async function openForm(page: Page, cityName: string) {
  await ownData(page)
    .getByRole('button', { name: new RegExp(`${en.city.rate}|${en.city.changeRating}`) })
    .click();
  return page.getByRole('dialog', { name: form.title.replace('{city}', cityName) });
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.goto('/');
  await signInTestUser(page, testInfo);
  await clerk.loaded({ page });
  // Both cities are visited, so they can be rated (BR-005). Setting the count is idempotent.
  for (const city of [e2eCities.rating, e2eCities.unrated]) {
    expect(
      await callApiAsUser(page, 'PUT', `/v1/cities/${city}/undated-visits`, {
        count: 1,
        beforeRegistration: true,
      }),
    ).toBe(200);
  }
});

test('a city without a visit cannot be rated (FR-RATE-001)', async ({ page }) => {
  await page.goto(`/cities/${e2eCities.point}`);

  await expect(ownData(page)).toBeVisible();
  await expect(ownData(page).getByRole('button', { name: en.city.rate })).toHaveCount(0);
});

test('a rating of two criteria and a changed suggestion is saved (FR-RATE-001…003)', async ({
  page,
}) => {
  await page.goto(`/cities/${e2eCities.rating}`);
  const dialog = await openForm(page, 'Siegburg');

  for (const criterion of ['Urbanism', 'Greenery', 'Public transport', 'Cleanliness']) {
    await dialog.getByRole('combobox', { name: criterion }).selectOption('');
  }
  await dialog.getByRole('combobox', { name: 'Architecture' }).selectOption('7');
  await dialog.getByRole('combobox', { name: 'Safety' }).selectOption('9');
  await expect(dialog.getByText(form.suggested.replace('{value}', '8'))).toBeVisible();
  await dialog.getByRole('combobox', { name: form.subjective }).selectOption('9.5');
  await dialog.getByRole('button', { name: form.save }).click();

  await expect(ownData(page).getByRole('status')).toHaveText(en.city.ratingSaved);
  await expect(dialog).toBeHidden();
  await expect(ownData(page).getByText('9.5', { exact: true })).toBeVisible();

  const response = await fetchApiAsUser(page, 'GET', `/v1/cities/${e2eCities.rating}/rating`);
  expect(response.status).toBe(200);
  const rating = (await response.json()) as CityRating;
  expect(rating.subjective).toBe(9.5);
  expect(rating.criteria).toEqual({ architecture: 7, safety: 9 });
});

test.describe('the suggested rating', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/cities/${e2eCities.unrated}`);
  });

  test('follows the criteria average until the user picks a rating (FR-RATE-003, BR-007)', async ({
    page,
  }) => {
    const dialog = await openForm(page, 'Brühl');
    const subjective = dialog.getByRole('combobox', { name: form.subjective });

    await dialog.getByRole('combobox', { name: 'Architecture' }).selectOption('7');
    await dialog.getByRole('combobox', { name: 'Urbanism' }).selectOption('8');
    await dialog.getByRole('combobox', { name: 'Greenery' }).selectOption('9');
    await expect(subjective).toHaveValue('8');

    // 7 and 7.5 average to 7.25, which is rounded up.
    await dialog.getByRole('combobox', { name: 'Urbanism' }).selectOption('7.5');
    await dialog.getByRole('combobox', { name: 'Greenery' }).selectOption('');
    await expect(subjective).toHaveValue('7.5');

    await subjective.selectOption('6');
    await dialog.getByRole('combobox', { name: 'Safety' }).selectOption('10');
    await expect(subjective).toHaveValue('6');

    await dialog.getByRole('button', { name: form.useSuggested }).click();
    await expect(subjective).toHaveValue('8');
  });

  test('is not saved without a subjective rating (BR-006)', async ({ page }) => {
    const dialog = await openForm(page, 'Brühl');
    await dialog.getByRole('button', { name: form.save }).click();

    await expect(dialog.getByRole('alert')).toHaveText(form.problem.subjective_required);
    await expect(dialog).toBeVisible();
  });
});
