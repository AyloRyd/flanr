import { clerk } from '@clerk/testing/playwright';
import type { Visit } from '@flanr/shared';
import { expect, test, type Page } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { e2eCities } from './database';
import { fetchApiAsUser, signInTestUser } from './users';

const form = en.city.visitForm;
const city = e2eCities.visits;

const logVisitButton = (page: Page) => page.getByRole('button', { name: en.city.logVisit });

/** Opens the visit form on the city page and picks how precise the date is. */
async function openForm(page: Page, precision: keyof typeof form.precisionOption) {
  await logVisitButton(page).click();
  const dialog = page.getByRole('dialog', { name: form.title.replace('{city}', 'Bonn') });
  await dialog.getByRole('radio', { name: form.precisionOption[precision] }).check();
  return dialog;
}

/** The user's visits to the city, as the API has them. */
async function visitsToCity(page: Page): Promise<Visit[]> {
  const response = await fetchApiAsUser(page, 'GET', `/v1/visits?cityId=${city}&limit=100`);
  expect(response.status).toBe(200);
  return ((await response.json()) as { items: Visit[] }).items;
}

// The tests only add visits and look for the one they added, so that runs of the same test at
// the same time do not change what another run expects.

test('a guest who logs a visit is asked to sign in (FR-AUTH-002)', async ({ page }) => {
  await page.goto(`/cities/${city}`);
  await clerk.loaded({ page });

  await logVisitButton(page).click();

  await expect(page.getByRole('dialog', { name: en.city.signInPrompt.visitTitle })).toBeVisible();
});

test.describe('signed in', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto('/');
    await signInTestUser(page, testInfo);
    await page.goto(`/cities/${city}`);
    await clerk.loaded({ page });
  });

  test('a visit with day precision is saved (FR-VIS-001, FR-VIS-002)', async ({ page }) => {
    const dialog = await openForm(page, 'day');
    await dialog.getByLabel(form.date, { exact: true }).fill('2025-03-14');
    await dialog.getByRole('button', { name: form.save }).click();

    await expect(page.getByRole('status')).toHaveText(en.city.visitSaved);
    await expect(dialog).toBeHidden();
    expect(await visitsToCity(page)).toContainEqual(
      expect.objectContaining({ date: '2025-03-14', datePrecision: 'day' }),
    );
  });

  test('a visit with only a month and a year has month precision (FR-VIS-002)', async ({
    page,
  }) => {
    const dialog = await openForm(page, 'month');
    await dialog.getByRole('combobox', { name: form.month }).selectOption({ label: 'May' });
    await dialog.getByRole('spinbutton', { name: form.year }).fill('2024');
    await dialog.getByRole('button', { name: form.save }).click();

    await expect(page.getByRole('status')).toHaveText(en.city.visitSaved);
    expect(await visitsToCity(page)).toContainEqual(
      expect.objectContaining({ date: '2024-05', datePrecision: 'month' }),
    );
    const own = page.getByRole('region', { name: en.city.yours });
    await expect(own.getByText('May 2024').first()).toBeVisible();
  });

  test('a visit in the future is rejected (FR-VIS-002, BR-003)', async ({ page }) => {
    const dialog = await openForm(page, 'year');
    await dialog
      .getByRole('spinbutton', { name: form.year })
      .fill(String(new Date().getFullYear() + 1));
    await dialog.getByRole('button', { name: form.save }).click();

    await expect(dialog.getByRole('alert')).toHaveText(form.problem.date_in_future);
    await expect(dialog).toBeVisible();
  });

  test('an incomplete date is not saved', async ({ page }) => {
    const dialog = await openForm(page, 'month');
    await dialog.getByRole('spinbutton', { name: form.year }).fill('2024');
    await dialog.getByRole('button', { name: form.save }).click();

    await expect(dialog.getByRole('alert')).toHaveText(form.problem.incomplete);
  });

  test('a visit without a date needs the confirmation that it was before registration (FR-VIS-003)', async ({
    page,
  }) => {
    const before = (await visitsToCity(page)).filter((visit) => visit.date === null).length;
    const dialog = await openForm(page, 'none');
    await dialog.getByRole('button', { name: form.save }).click();
    await expect(dialog.getByRole('alert')).toHaveText(form.problem.date_required);

    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: form.save }).click();

    await expect(page.getByRole('status')).toHaveText(en.city.visitSaved);
    const undated = (await visitsToCity(page)).filter((visit) => visit.date === null);
    expect(undated.length).toBeGreaterThan(before);
    expect(undated[0]?.beforeRegistration).toBe(true);
  });

  test('the help hint shows the recommended visit model (FR-VIS-008)', async ({ page }) => {
    const dialog = await openForm(page, 'day');
    const hint = dialog.getByText(form.helpText);
    await expect(hint).toBeHidden();

    await dialog.getByText(form.helpTitle).click();

    await expect(hint).toBeVisible();
  });
});
