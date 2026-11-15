import { expect, test } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { e2eCities } from './database';

test('a guest sees the data of a city (FR-CITY-001, FR-AUTH-001)', async ({ page }) => {
  await page.goto(`/cities/${e2eCities.cologne}`);

  await expect(page).toHaveTitle(`Köln · ${en.app.name}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Köln');
  await expect(page.getByText('Cologne', { exact: true })).toBeVisible();
  await expect(page.getByText('City · North Rhine-Westphalia, Germany')).toBeVisible();
  await expect(page.getByText('1,000,000 (2024)')).toBeVisible();
  await expect(page.getByText('400 km²', { exact: true })).toBeVisible();
  await expect(page.getByText('2,500 per km²')).toBeVisible();
  await expect(page.getByRole('link', { name: en.city.wikipedia })).toHaveAttribute(
    'href',
    'https://de.wikipedia.org/wiki/K%C3%B6ln',
  );
});

test('the community rating is shown as 7.83 with 3 ratings (FR-CITY-003)', async ({ page }) => {
  await page.goto(`/cities/${e2eCities.cologne}`);

  const rating = page.getByRole('region', { name: en.city.communityRating });
  await expect(rating.getByText('7.83')).toBeVisible();
  await expect(rating.getByText('3 ratings')).toBeVisible();
});

test('Worringen is shown as part of Cologne (FR-CITY-001)', async ({ page }) => {
  await page.goto(`/cities/${e2eCities.worringen}`);

  await expect(page.getByText('Part of Köln')).toBeVisible();
});

test('unknown facts and a missing rating are not shown as empty (FR-CITY-002, FR-CITY-003)', async ({
  page,
}) => {
  await page.goto(`/cities/${e2eCities.point}`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Punkt');
  await expect(page.getByText(en.city.population)).toHaveCount(0);
  await expect(page.getByRole('region', { name: en.city.facts })).toHaveCount(0);
  await expect(page.getByText(en.city.noRatings)).toBeVisible();
});

test('the OpenStreetMap link opens the imported object (FR-CITY-009)', async ({ page }) => {
  await page.goto(`/cities/${e2eCities.cologne}`);

  await expect(page.getByRole('link', { name: 'Open in OpenStreetMap' })).toHaveAttribute(
    'href',
    'https://www.openstreetmap.org/relation/62578',
  );
});

test('an unknown or malformed city ID shows the not-found page', async ({ page }) => {
  for (const id of ['999999', 'abc']) {
    const response = await page.goto(`/cities/${id}`);

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.notFound.title);
  }
});
