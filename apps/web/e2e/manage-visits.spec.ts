import { clerk } from '@clerk/testing/playwright';
import type { Visit } from '@flanr/shared';
import { expect, test, type Page } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { e2eCities } from './database';
import { callApiAsUser, fetchApiAsUser, signInTestUser } from './users';

const own = en.city.ownVisits;
const cityNames = ['Hürth', 'Kerpen'];

/** The city of the running repetition, and its name. */
let city: number;
let cityName: string;

const ownData = (page: Page) => page.getByRole('region', { name: en.city.yours });

/** The user's visits to the city, as the API has them. */
async function visitsToCity(page: Page): Promise<Visit[]> {
  const response = await fetchApiAsUser(page, 'GET', `/v1/visits?cityId=${city}&limit=100`);
  expect(response.status).toBe(200);
  return ((await response.json()) as { items: Visit[] }).items;
}

/** Logs a visit through the API and returns it. */
async function addVisit(page: Page, date: string): Promise<Visit> {
  const response = await fetchApiAsUser(page, 'POST', '/v1/visits', {
    cityId: city,
    date,
    beforeRegistration: false,
  });
  expect(response.status).toBe(201);
  return (await response.json()) as Visit;
}

/** Removes all visits to the city and its rating, so every test starts from nothing. */
async function resetCity(page: Page): Promise<void> {
  for (const visit of await visitsToCity(page)) {
    if (visit.date === null) continue;
    await callApiAsUser(page, 'DELETE', `/v1/visits/${visit.id}?confirmRatingDeletion=true`);
  }
  await callApiAsUser(page, 'PUT', `/v1/cities/${city}/undated-visits`, {
    count: 0,
    confirmRatingDeletion: true,
  });
  await callApiAsUser(page, 'DELETE', `/v1/cities/${city}/rating`);
}

/** Today in UTC, the day the API counts the registration from. */
const todayUtc = () => new Date().toISOString().slice(0, 10);

test.beforeEach(async ({ page }, testInfo) => {
  const index = testInfo.repeatEachIndex % e2eCities.manageVisits.length;
  city = e2eCities.manageVisits[index] ?? e2eCities.manageVisits[0];
  cityName = cityNames[index] ?? '';
  await page.goto('/');
  await signInTestUser(page, testInfo);
  await clerk.loaded({ page });
  await resetCity(page);
});

test('the date of a visit is changed (FR-VIS-006)', async ({ page }) => {
  const visit = await addVisit(page, '2023-06-10');
  await page.goto(`/cities/${city}`);

  await ownData(page)
    .getByRole('button', { name: own.edit.replace('{date}', 'Jun 10, 2023') })
    .click();
  const dialog = page.getByRole('dialog', { name: own.editTitle });
  await expect(dialog.getByLabel(en.city.visitForm.date, { exact: true })).toHaveValue(
    '2023-06-10',
  );
  await dialog.getByRole('radio', { name: en.city.visitForm.precisionOption.month }).check();
  await dialog
    .getByRole('combobox', { name: en.city.visitForm.month })
    .selectOption({ label: 'January' });
  await dialog.getByRole('spinbutton', { name: en.city.visitForm.year }).fill('2022');
  await dialog.getByRole('button', { name: en.city.visitForm.save }).click();

  await expect(ownData(page).getByRole('status')).toHaveText(own.status.visitChanged);
  await expect(ownData(page).getByText('January 2022')).toBeVisible();
  expect(await visitsToCity(page)).toEqual([
    expect.objectContaining({ id: visit.id, date: '2022-01', datePrecision: 'month' }),
  ]);
});

test('a visit after the registration cannot lose its date (FR-VIS-004)', async ({ page }) => {
  await addVisit(page, todayUtc());
  await page.goto(`/cities/${city}`);

  await ownData(page)
    .getByRole('button', { name: /^Change the visit of/ })
    .click();
  const dialog = page.getByRole('dialog', { name: own.editTitle });

  await expect(
    dialog.getByRole('radio', { name: en.city.visitForm.precisionOption.day }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('radio', { name: en.city.visitForm.precisionOption.none }),
  ).toHaveCount(0);
});

test('deleting the only visit takes the city off the Visited list (FR-VIS-006)', async ({
  page,
}) => {
  await addVisit(page, '2021-03-10');
  await page.goto(`/cities/${city}`);

  await ownData(page)
    .getByRole('button', { name: own.delete.replace('{date}', 'Mar 10, 2021') })
    .click();
  const dialog = page.getByRole('alertdialog', { name: own.deleteTitle });
  await expect(dialog).toContainText(own.deleteText.replace('{date}', 'Mar 10, 2021'));
  await dialog.getByRole('button', { name: own.deleteVisit }).click();

  await expect(ownData(page).getByRole('status')).toHaveText(own.status.visitDeleted);
  await expect(ownData(page).getByText('No visits yet')).toBeVisible();
  // The city is no longer visited, so it can be planned again (BR-004).
  await expect(page.getByRole('button', { name: en.city.plan })).toBeVisible();
  expect(await visitsToCity(page)).toEqual([]);
});

test('deleting the only visit to a rated city warns that the rating goes too (FR-VIS-006, BR-005)', async ({
  page,
}) => {
  await addVisit(page, '2021-03-10');
  expect(await callApiAsUser(page, 'PUT', `/v1/cities/${city}/rating`, { subjective: 6 })).toBe(
    200,
  );
  await page.goto(`/cities/${city}`);

  await ownData(page)
    .getByRole('button', { name: own.delete.replace('{date}', 'Mar 10, 2021') })
    .click();
  const dialog = page.getByRole('alertdialog', { name: own.deleteTitle });
  await expect(dialog).toContainText(own.deleteWithRating.replace('{date}', 'Mar 10, 2021'));
  await dialog.getByRole('button', { name: own.deleteVisitAndRating }).click();

  await expect(ownData(page).getByText(en.city.notRatedByYou)).toBeVisible();
  expect(await callApiAsUser(page, 'GET', `/v1/cities/${city}/rating`)).toBe(404);
});

test('the number of undated visits is set directly (FR-VIS-005)', async ({ page }) => {
  await addVisit(page, '2020-08');
  expect(
    await callApiAsUser(page, 'PUT', `/v1/cities/${city}/undated-visits`, {
      count: 5,
      beforeRegistration: true,
    }),
  ).toBe(200);
  await page.goto(`/cities/${city}`);
  const form = en.city.undatedForm;
  const dialog = page.getByRole('dialog', { name: form.title });

  // More visits need the confirmation that they were before the registration (FR-VIS-003).
  await ownData(page).getByRole('button', { name: own.changeUndatedLabel }).click();
  await dialog.getByRole('spinbutton', { name: form.count }).fill('6');
  await dialog.getByRole('button', { name: form.save, exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(form.problem.date_required);
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: form.save, exact: true }).click();
  await expect(ownData(page).getByText('6 visits without a date')).toBeVisible();

  await ownData(page).getByRole('button', { name: own.changeUndatedLabel }).click();
  await dialog.getByRole('spinbutton', { name: form.count }).fill('4');
  await dialog.getByRole('button', { name: form.save, exact: true }).click();
  await expect(ownData(page).getByText('4 visits without a date')).toBeVisible();

  const visits = await visitsToCity(page);
  expect(visits.filter((visit) => visit.date === null)).toHaveLength(4);
  // Dated visits are not affected.
  expect(visits.filter((visit) => visit.date !== null)).toEqual([
    expect.objectContaining({ date: '2020-08' }),
  ]);
});

test('the rating is deleted and the visits stay (FR-RATE-004)', async ({ page }) => {
  await addVisit(page, '2019');
  expect(
    await callApiAsUser(page, 'PUT', `/v1/cities/${city}/rating`, {
      subjective: 7,
      criteria: { safety: 8 },
    }),
  ).toBe(200);
  await page.goto(`/cities/${city}`);

  await ownData(page).getByRole('button', { name: en.city.changeRating }).click();
  const form = page.getByRole('dialog', {
    name: en.city.ratingForm.title.replace('{city}', cityName),
  });
  await form.getByRole('button', { name: en.city.ratingForm.delete }).click();
  const confirm = page.getByRole('alertdialog', { name: en.city.ratingForm.deleteTitle });
  await confirm.getByRole('button', { name: en.city.ratingForm.delete }).click();

  await expect(ownData(page).getByRole('status')).toHaveText(en.city.ratingDeleted);
  await expect(ownData(page).getByText(en.city.notRatedByYou)).toBeVisible();
  expect(await callApiAsUser(page, 'GET', `/v1/cities/${city}/rating`)).toBe(404);
  expect(await visitsToCity(page)).toHaveLength(1);
});
