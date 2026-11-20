import { clerk } from '@clerk/testing/playwright';
import type { CurrentUser } from '@flanr/shared';
import type { Page } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { e2eCities } from './database';
import type { ClerkTestUser } from './fresh-user';
import { expect, test } from './test';
import { callApiAsUser, fetchApiAsUser } from './users';

// The map workspace (FR-MAP-008, SRS §6.1). As in map.spec.ts, the tests run without a Mapbox
// token: they check the panels, lists, legends and calendar around the map, not the map itself.
const workspace = en.workspace;
const legend = en.map.legend;
const { cologne } = e2eCities;
const { visited, lived, planned } = e2eCities.map;

const todayUtc = () => new Date().toISOString().slice(0, 10);

/** A fresh user who visited Leverkusen twice today, lives in Monheim and plans Zons. */
async function signInWithCities(page: Page, user: ClerkTestUser): Promise<CurrentUser> {
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.emailAddress });
  await clerk.loaded({ page });
  for (let visit = 0; visit < 2; visit += 1) {
    expect(
      await callApiAsUser(page, 'POST', '/v1/visits', { cityId: visited, date: todayUtc() }),
    ).toBe(201);
  }
  expect(await callApiAsUser(page, 'PUT', `/v1/lived-cities/${lived}`, { isCurrent: false })).toBe(
    200,
  );
  expect(await callApiAsUser(page, 'PUT', `/v1/planned-cities/${planned}`)).toBe(200);
  return (await (await fetchApiAsUser(page, 'GET', '/v1/me')).json()) as CurrentUser;
}

const cityPanel = (page: Page, city: string) =>
  page.getByRole('complementary', { name: workspace.panel.label.replace('{city}', city) });
const leftPanel = (page: Page) => page.getByRole('complementary', { name: workspace.leftPanel });

test('a guest goes from the landing page to the map and opens a city (FR-MAP-008, FR-MAP-004)', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.home.title);
  await page.getByRole('link', { name: en.home.explore }).click();
  await expect(page).toHaveURL(/\/map$/);
  // No personal data for a guest: the left panel offers to sign in.
  await page.getByRole('button', { name: workspace.toggleLeftPanel }).click();
  await expect(leftPanel(page)).toContainText(workspace.guest);
  await expect(page.getByRole('radio', { name: en.map.mode.visits })).toHaveCount(0);

  // A city panel by its URL, as a click on the city's name opens it.
  await page.goto(`/map/cities/${cologne}`);
  const panel = cityPanel(page, 'Köln');
  await expect(panel.getByRole('heading', { level: 1 })).toHaveText('Köln');
  await expect(panel).toContainText('7.83');
  // Logging a visit asks a guest to sign in or sign up.
  await panel.getByRole('button', { name: en.city.logVisit }).click();
  await expect(page.getByRole('dialog', { name: en.city.signInPrompt.visitTitle })).toBeVisible();
});

test('the city panel expands to the city page and the page leads back to the map (FR-MAP-004)', async ({
  page,
}) => {
  await page.goto(`/map/cities/${cologne}`);
  await cityPanel(page, 'Köln').getByRole('link', { name: workspace.panel.expand }).click();
  await expect(page).toHaveURL(new RegExp(`/cities/${cologne}$`));
  // The full page, which is compiled on its first visit in development.
  const showOnMap = page.getByRole('link', { name: workspace.showOnMap });
  await expect(showOnMap).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Köln');

  await showOnMap.click();
  await expect(page).toHaveURL(new RegExp(`/map/cities/${cologne}$`));
  await cityPanel(page, 'Köln').getByRole('link', { name: workspace.panel.close }).click();
  await expect(page).toHaveURL(/\/map$/);
  await expect(cityPanel(page, 'Köln')).toHaveCount(0);
});

test('the city panel is not indexed and points to the city page (NFR-SEO-003)', async ({
  page,
}) => {
  await page.goto(`/map/cities/${cologne}`);

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    new RegExp(`/cities/${cologne}$`),
  );
});

test('a signed-in user sees their cities, lists and trip calendar next to the map (FR-MAP-008, FR-STAT-003)', async ({
  page,
  freshUser,
}) => {
  await signInWithCities(page, freshUser);
  // The landing page sends a signed-in user to the map.
  await page.goto('/');
  await expect(page).toHaveURL(/\/map$/);

  // The modes and their legends (FR-MAP-005).
  const legendList = page.getByRole('list', { name: legend.title });
  await expect(legendList.getByRole('listitem').filter({ hasText: legend.lived })).toHaveText(
    new RegExp(`${legend.lived}\\s*1$`),
  );
  await page.getByRole('radio', { name: en.map.mode.population }).click();
  await expect(
    legendList.getByRole('listitem').filter({ hasText: legend.population100k }),
  ).toHaveText(new RegExp(`${legend.population100k}\\s*1$`));
  await page.getByRole('checkbox', { name: workspace.values }).check();
  // The choice is remembered in this browser.
  await page.reload();
  await expect(page.getByRole('radio', { name: en.map.mode.population })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: workspace.values })).toBeChecked();

  // The Visited list opens a city's panel.
  await page.getByRole('button', { name: workspace.toggleLeftPanel }).click();
  const visitedList = leftPanel(page).getByRole('list', { name: workspace.lists.visited });
  await expect(visitedList.getByRole('listitem')).toHaveCount(2);
  await expect(visitedList).toContainText(workspace.lists.livedIn);
  await visitedList.getByRole('button', { name: /Leverkusen/ }).click();
  await expect(page).toHaveURL(new RegExp(`/map/cities/${visited}$`));
  await expect(cityPanel(page, 'Leverkusen')).toBeVisible();

  // The Planned list.
  if (!(await leftPanel(page).isVisible())) {
    await page.getByRole('button', { name: workspace.toggleLeftPanel }).click();
  }
  await leftPanel(page)
    .getByRole('tab', { name: /Planned/ })
    .click();
  await expect(leftPanel(page).getByRole('list', { name: workspace.lists.planned })).toContainText(
    'Zons',
  );

  // The trip calendar: today has the two visits to Leverkusen (FR-STAT-003).
  await leftPanel(page).getByRole('tab', { name: workspace.tabs.calendar }).click();
  const calendar = page.getByRole('region', { name: workspace.calendar.title });
  const today = calendar.getByRole('button', { name: /2 visits, Leverkusen, Leverkusen/ });
  await expect(today).toBeVisible();
  await today.click();
  await calendar
    .getByRole('list', { name: workspace.calendar.citiesOfDay })
    .getByRole('button')
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/map/cities/${visited}$`));
});
