import type { Page } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { signInTestUser, fetchApiAsUser } from './users';
import { expect, test } from './test';

const search = en.search;
const filters = search.filters;

const results = (page: Page) => page.getByRole('list', { name: search.results });

async function searchCities(page: Page, text: string) {
  await page.getByRole('searchbox', { name: search.cityLabel }).fill(text);
  await page.getByRole('button', { name: search.submit, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(text)}`));
}

test('a guest reaches the search from the header and finds Köln as "Cologne" (FR-SRCH-001, FR-SRCH-002)', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: en.nav.search }).click();
  await expect(page).toHaveURL(/\/search$/);

  await searchCities(page, 'Cologne');

  const first = results(page).getByRole('listitem').first();
  await expect(first.getByRole('link', { name: 'Köln' })).toBeVisible();
  await expect(first).toContainText('City · North Rhine-Westphalia, Germany');
  await first.getByRole('link', { name: 'Köln' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Köln');
});

test('a search without diacritics finds Köln (FR-SRCH-001)', async ({ page }) => {
  await page.goto('/search?q=Koln');
  await expect(results(page).getByRole('link', { name: 'Köln' })).toBeVisible();
});

test('a city that is part of a municipality shows it (FR-SRCH-002, BR-017)', async ({ page }) => {
  await page.goto('/search?q=Worringen');
  await expect(results(page).getByRole('listitem').first()).toContainText(/Part of (Köln|Cologne)/);
});

test('the settlement type filter lists only villages (FR-SRCH-003)', async ({ page }) => {
  await page.goto('/search');
  await page.getByText(filters.title).click();
  await page.getByRole('checkbox', { name: filters.settlementTypes.village }).check();
  await page.getByRole('button', { name: filters.apply }).click();

  await expect(page).toHaveURL(/settlementType=village/);
  await expect(results(page).getByRole('listitem')).toHaveCount(1);
  await expect(results(page)).toContainText('Worringen');
});

test('choosing a country offers its regions (FR-SRCH-003)', async ({ page }) => {
  await page.goto('/search');
  await page.getByText(filters.title).click();
  await page.getByRole('combobox', { name: filters.country }).selectOption({ label: 'Germany' });

  await expect(page).toHaveURL(/country=DE/);
  const region = page.getByRole('combobox', { name: filters.region });
  await expect(region).toBeEnabled();
  await region.selectOption({ label: 'North Rhine-Westphalia' });
  await page.getByRole('button', { name: filters.apply }).click();
  await expect(page).toHaveURL(/regionId=1/);
  await expect(results(page).getByRole('link', { name: 'Köln' })).toBeVisible();
});

test('sorting by community rating needs 10 ratings unless the user sets fewer (FR-SRCH-003)', async ({
  page,
}) => {
  await page.goto('/search');
  await page.getByText(filters.title).click();
  await page.getByRole('combobox', { name: filters.sort }).selectOption({
    label: filters.sortBy.rating,
  });
  await page.getByRole('button', { name: filters.apply }).click();
  // Köln has 3 ratings, fewer than the default minimum of 10; no other city has more.
  await expect(page.getByText(search.noCities)).toBeVisible();

  await page.getByRole('spinbutton', { name: filters.minRatings }).fill('3');
  await page.getByRole('button', { name: filters.apply }).click();
  const first = results(page).getByRole('listitem').first();
  await expect(first.getByRole('link', { name: 'Köln' })).toBeVisible();
  await expect(first).toContainText('7.83');
});

test('a reversed population range is explained', async ({ page }) => {
  await page.goto('/search?populationMin=5000&populationMax=100');
  await expect(page.getByText(search.problem.population_range)).toBeVisible();
});

test('a guest finds a public list by a word of its title (FR-SRCH-004, FR-LIST-006)', async ({
  page,
  browser,
}, testInfo) => {
  const word = `fachwerk${testInfo.project.name}${testInfo.repeatEachIndex}${Date.now()}`;
  await page.goto('/');
  await signInTestUser(page, testInfo);
  const response = await fetchApiAsUser(page, 'POST', '/v1/lists', {
    title: `Half-timbered towns ${word}`,
    description: 'Old towns with timber-framed houses.',
    visibility: 'public',
  });
  expect(response.status).toBe(201);

  const guest = await browser.newPage();
  await guest.goto('/search');
  await guest.getByRole('link', { name: search.lists }).click();
  await guest.getByRole('searchbox', { name: search.listLabel }).fill(word);
  await guest.getByRole('button', { name: search.submit, exact: true }).click();

  const found = results(guest).getByRole('listitem');
  await expect(found).toHaveCount(1);
  await expect(found).toContainText(`Half-timbered towns ${word}`);
  await expect(found).toContainText('0 cities');
  await guest.close();
});
