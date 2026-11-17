import { clerk } from '@clerk/testing/playwright';
import type { CurrentUser } from '@flanr/shared';
import type { Page } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { e2eCities } from './database';
import type { ClerkTestUser } from './fresh-user';
import { expect, test } from './test';
import { callApiAsUser, fetchApiAsUser } from './users';

// The tests run without a Mapbox token, as in CI, so Mapbox draws nothing (see
// playwright.config.ts). They check what the map is given: the legends with the number of
// cities in each class, the modes, the planned cities and the preview of a selected city.
const map = en.map;
const legend = map.legend;
const { cologne } = e2eCities;
const { visited, lived, planned } = e2eCities.map;

const todayUtc = () => new Date().toISOString().slice(0, 10);

/**
 * Signs in a fresh user and gives them a known map: Leverkusen visited three times, Monheim
 * lived in without visits, Cologne visited once, Zons planned. With `rate`, Leverkusen is also
 * rated 5; ratings count towards the community rating, so only one test rates (see database.ts).
 */
async function signInWithMap(
  page: Page,
  user: ClerkTestUser,
  { rate = false } = {},
): Promise<CurrentUser> {
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.emailAddress });
  await clerk.loaded({ page });
  for (let visit = 0; visit < 3; visit += 1) {
    expect(
      await callApiAsUser(page, 'POST', '/v1/visits', { cityId: visited, date: todayUtc() }),
    ).toBe(201);
  }
  if (rate) {
    const rating = { subjective: 5 };
    expect(await callApiAsUser(page, 'PUT', `/v1/cities/${visited}/rating`, rating)).toBe(200);
  }
  expect(await callApiAsUser(page, 'PUT', `/v1/lived-cities/${lived}`, { isCurrent: false })).toBe(
    200,
  );
  expect(
    await callApiAsUser(page, 'POST', '/v1/visits', { cityId: cologne, date: todayUtc() }),
  ).toBe(201);
  expect(await callApiAsUser(page, 'PUT', `/v1/planned-cities/${planned}`)).toBe(200);
  return (await (await fetchApiAsUser(page, 'GET', '/v1/me')).json()) as CurrentUser;
}

const legendList = (page: Page) => page.getByRole('list', { name: legend.title });

/** Expects the legend line with this label to count this many cities. */
async function expectCount(page: Page, label: string, count: number) {
  const line = legendList(page).getByRole('listitem').filter({ hasText: label });
  await expect(line).toHaveText(new RegExp(`${label}\\s*${count}$`));
}

const mapPath = (username: string, query = '') => `/users/${username}/map${query}`;

test('the owner’s map shows the cities in three modes with legends (FR-MAP-005, FR-MAP-006)', async ({
  page,
  freshUser,
}) => {
  const me = await signInWithMap(page, freshUser, { rate: true });
  await page.goto(`/users/${me.username}`);
  await page.getByRole('link', { name: en.profile.map }).click();
  await expect(page).toHaveURL(new RegExp(`${mapPath(me.username)}$`));
  // Without a token the page says so instead of drawing the map, and everything else works.
  await expect(page.getByText(map.unavailable)).toBeVisible();

  // By visits: a lived-in city has a class of its own above any number of visits (BR-016).
  await expectCount(page, legend.lived, 1);
  await expectCount(page, legend.visits10, 0);
  await expectCount(page, legend.visits2, 1);
  await expectCount(page, legend.visits1, 1);

  await page.getByRole('radio', { name: map.mode.rating }).click();
  await expectCount(page, legend.rated, 1);
  await expectCount(page, legend.unrated, 2);
  await expect(page).toHaveURL(/\?mode=rating$/);

  await page.getByRole('radio', { name: map.mode.population }).click();
  await expectCount(page, legend.population100k, 1);
  await expectCount(page, legend.population10k, 1);
  // Cologne has a population of a million in the test data.
  await expectCount(page, legend.population1m, 1);

  // Planned cities are a layer of their own that the user turns on.
  await expect(legendList(page).getByText(legend.planned)).toBeHidden();
  await page.getByRole('checkbox', { name: map.showPlanned }).check();
  await expectCount(page, legend.planned, 1);

  // The view is in the URL and survives a reload.
  await expect(page).toHaveURL(/\?mode=population&planned=1$/);
  await page.reload();
  await expect(page.getByRole('radio', { name: map.mode.population })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: map.showPlanned })).toBeChecked();
});

test('a selected city shows its preview with the user’s own data (FR-MAP-004)', async ({
  page,
  freshUser,
}) => {
  const me = await signInWithMap(page, freshUser);
  const preview = page.getByRole('region', { name: map.preview.label });

  await page.goto(mapPath(me.username, `?city=${cologne}`));
  await expect(preview.getByRole('heading', { name: 'Köln' })).toBeVisible();
  await expect(preview).toContainText('North Rhine-Westphalia, Germany');
  // The community rating of Cologne in the test data: 7, 8 and 8.5.
  await expect(preview).toContainText('7.83');
  await expect(preview).toContainText('3 ratings');
  await expect(preview).toContainText(map.preview.yours);
  await expect(preview).toContainText('1 visit');

  await page.goto(mapPath(me.username, `?city=${lived}`));
  await expect(preview).toContainText(map.preview.livedIn);
  await page.goto(mapPath(me.username, `?city=${planned}`));
  await expect(preview).toContainText(map.preview.planned);

  await preview.getByRole('button', { name: map.preview.close }).click();
  await expect(preview).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${mapPath(me.username)}$`));

  await page.goto(mapPath(me.username, `?city=${cologne}`));
  await preview.getByRole('link', { name: map.preview.open }).click();
  await expect(page).toHaveURL(new RegExp(`/cities/${cologne}$`));
});

test('others see the map of a public profile, but not of a private one (FR-MAP-007, FR-PRIV-001)', async ({
  page,
  browser,
  freshUser,
}) => {
  const me = await signInWithMap(page, freshUser);
  const guest = await browser.newPage();

  await guest.goto(mapPath(me.username, `?city=${visited}`));
  await expectCount(guest, legend.lived, 1);
  await expectCount(guest, legend.visits2, 1);
  const preview = guest.getByRole('region', { name: map.preview.label });
  await expect(preview).toContainText(me.displayName);
  await expect(preview).toContainText('3 visits');

  expect(await callApiAsUser(page, 'PATCH', '/v1/me', { profileVisibility: 'private' })).toBe(200);
  await guest.goto(`/users/${me.username}`);
  await expect(guest.getByRole('link', { name: en.profile.map })).toBeHidden();
  await guest.goto(mapPath(me.username));
  await expect(legendList(guest)).toBeHidden();
  await guest.close();
});
