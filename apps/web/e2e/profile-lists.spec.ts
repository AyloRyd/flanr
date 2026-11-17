import { clerk } from '@clerk/testing/playwright';
import type { CurrentUser, List } from '@flanr/shared';
import type { Page, TestInfo } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { e2eCities } from './database';
import { expect, test } from './test';
import { callApiAsUser, fetchApiAsUser, signInTestUser, type TestUserPurpose } from './users';

const profile = en.profile;
const lists = en.lists;

/** Signs in a test user and returns their Flanr username. */
async function signIn(page: Page, testInfo: TestInfo, purpose: TestUserPurpose = 'main') {
  await page.goto('/');
  await signInTestUser(page, testInfo, purpose);
  await clerk.loaded({ page });
  const response = await fetchApiAsUser(page, 'GET', '/v1/me');
  return ((await response.json()) as CurrentUser).username;
}

/** Creates a list through the API with a title no other run uses. */
async function createList(page: Page, testInfo: TestInfo, visibility: 'public' | 'private') {
  const title = `List ${testInfo.project.name} ${testInfo.repeatEachIndex} ${Date.now()}`;
  const response = await fetchApiAsUser(page, 'POST', '/v1/lists', { title, visibility });
  expect(response.status).toBe(201);
  return (await response.json()) as List;
}

const visitedList = (page: Page) => page.getByRole('list', { name: profile.visited });

test.describe('a public profile', () => {
  let username: string;

  test.beforeEach(async ({ page }, testInfo) => {
    username = await signIn(page, testInfo);
    // Kept in a known state; setting the same values again changes nothing.
    expect(
      await callApiAsUser(page, 'PUT', `/v1/cities/${e2eCities.profileVisited}/undated-visits`, {
        count: 1,
        beforeRegistration: true,
      }),
    ).toBe(200);
    expect(
      await callApiAsUser(page, 'PUT', `/v1/cities/${e2eCities.profileVisited}/rating`, {
        subjective: 7,
      }),
    ).toBe(200);
    expect(await callApiAsUser(page, 'PUT', `/v1/planned-cities/${e2eCities.profilePlanned}`)).toBe(
      200,
    );
  });

  test('the owner reaches it from the account menu and sees visits, ratings and plans (FR-PROF-004)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /open user menu/i }).click();
    await page.getByRole('button', { name: en.auth.profile }).click();
    await expect(page).toHaveURL(new RegExp(`/users/${username}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const bergheim = visitedList(page).getByRole('listitem').filter({ hasText: 'Bergheim' });
    await expect(bergheim).toContainText('1 visit');
    await expect(bergheim).toContainText('7');

    await page.getByRole('link', { name: profile.planned }).click();
    await expect(page.getByRole('list', { name: profile.planned })).toContainText('Erftstadt');
  });

  test('a guest sees the Visited list with ratings but no visit counts (FR-PROF-004, FR-PROF-003)', async ({
    browser,
  }) => {
    const guest = await browser.newPage();
    await guest.goto(`/users/${username}`);

    const bergheim = visitedList(guest).getByRole('listitem').filter({ hasText: 'Bergheim' });
    await expect(bergheim).toContainText('7');
    await expect(bergheim).not.toContainText('visit');
    await guest.close();
  });
});

test('the owner creates a list, fills it from city pages and reorders it (FR-LIST-003, FR-LIST-004)', async ({
  page,
}, testInfo) => {
  const username = await signIn(page, testInfo);
  const title = `Trams ${testInfo.project.name} ${testInfo.repeatEachIndex} ${Date.now()}`;

  await page.goto(`/users/${username}/lists`);
  await page.getByRole('button', { name: lists.new }).click();
  const form = page.getByRole('dialog', { name: lists.newTitle });
  await form.getByRole('textbox', { name: lists.form.title }).fill(title);
  await form.getByRole('button', { name: lists.create }).click();
  // Creating the list and opening it is a server redirect; slow while all tests run at once.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title, { timeout: 15_000 });
  const listUrl = page.url();

  // Add Bergheim from its city page.
  await page.goto(`/cities/${e2eCities.profileVisited}`);
  await page.getByRole('button', { name: lists.add.button }).click();
  const add = page.getByRole('dialog', { name: lists.add.title.replace('{city}', 'Bergheim') });
  await add.getByRole('checkbox', { name: title }).check();
  await expect(add.getByRole('checkbox', { name: title })).toBeChecked();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(
    page.getByRole('region', { name: en.city.yours }).getByRole('link', { name: title }),
  ).toBeVisible();

  // Two more through the API, then move the third to the top.
  const listId = Number(listUrl.split('/').at(-1));
  for (const cityId of [e2eCities.profilePlanned, e2eCities.cologne]) {
    expect(await callApiAsUser(page, 'POST', `/v1/lists/${listId}/entries`, { cityId })).toBe(201);
  }
  await page.goto(listUrl);
  const entries = page.getByRole('list', { name: lists.entries }).getByRole('listitem');
  await expect(entries).toHaveCount(3);
  await page.getByRole('button', { name: lists.entry.moveUp.replace('{city}', 'Köln') }).click();
  await expect(entries.nth(1)).toContainText('Köln');
  await page.getByRole('button', { name: lists.entry.moveUp.replace('{city}', 'Köln') }).click();
  await expect(entries.nth(0)).toContainText('Köln');
  await page.reload();
  await expect(entries.nth(0)).toContainText('Köln');
  await expect(entries.nth(1)).toContainText('Bergheim');
  await expect(entries.nth(2)).toContainText('Erftstadt');

  // A note on an entry.
  await page
    .getByRole('button', { name: lists.entry.editNote.replace('{city}', 'Bergheim') })
    .click();
  const note = page.getByRole('dialog', {
    name: lists.entry.noteTitle.replace('{city}', 'Bergheim'),
  });
  await note.getByRole('textbox', { name: lists.entry.note }).fill('The old tram depot.');
  await note.getByRole('button', { name: lists.entry.saveNote }).click();
  await expect(entries.nth(1)).toContainText('The old tram depot.');
});

test('a private list is hidden from others, and a deleted list is gone (FR-LIST-005, FR-LIST-003)', async ({
  page,
  browser,
}, testInfo) => {
  const username = await signIn(page, testInfo);
  const list = await createList(page, testInfo, 'public');
  const listPath = `/users/${username}/lists/${list.id}`;

  await page.goto(listPath);
  await page.getByRole('button', { name: lists.edit }).click();
  const form = page.getByRole('dialog', { name: lists.editTitle });
  await form.getByRole('radio', { name: new RegExp(`^${lists.form.private}`) }).check();
  await form.getByRole('button', { name: lists.save }).click();
  await expect(page.getByText(lists.privateBadge, { exact: false }).first()).toBeVisible();

  const guest = await browser.newPage();
  await guest.goto(listPath);
  await expect(guest.getByRole('heading', { name: en.notFound.title })).toBeVisible();
  await guest.goto(`/users/${username}/lists`);
  await expect(guest.getByRole('link', { name: list.title })).toHaveCount(0);

  await page.getByRole('button', { name: lists.delete }).click();
  await page
    .getByRole('alertdialog', { name: lists.deleteTitle })
    .getByRole('button', { name: lists.delete })
    .click();
  await expect(page).toHaveURL(new RegExp(`/users/${username}/lists$`));
  await expect(page.getByRole('link', { name: list.title })).toHaveCount(0);
  await guest.close();
});

test('a private profile shows only the name, bio and public lists (FR-PRIV-001, FR-LIST-005)', async ({
  page,
  browser,
}, testInfo) => {
  const username = await signIn(page, testInfo, 'private');
  expect(
    (await fetchApiAsUser(page, 'PATCH', '/v1/me', { profileVisibility: 'private' })).status,
  ).toBe(200);
  const publicList = await createList(page, testInfo, 'public');
  const privateList = await createList(page, testInfo, 'private');

  const guest = await browser.newPage();
  await guest.goto(`/users/${username}`);
  await expect(guest.getByText(profile.privateNote)).toBeVisible();
  await expect(guest.getByRole('link', { name: profile.visited })).toHaveCount(0);
  await expect(guest.getByRole('link', { name: publicList.title })).toBeVisible();
  await expect(guest.getByRole('link', { name: privateList.title })).toHaveCount(0);

  // A public list of a private profile opens for a guest (FR-LIST-005 AC3).
  await guest.getByRole('link', { name: publicList.title }).click();
  await expect(guest.getByRole('heading', { level: 1 })).toHaveText(publicList.title);
  await guest.goto(`/users/${username}/planned`);
  await expect(guest.getByText(profile.privateNote)).toBeVisible();
  await expect(guest.getByRole('list', { name: profile.planned })).toHaveCount(0);
  await guest.close();

  // The owner still sees everything, with a note that others do not.
  await page.goto(`/users/${username}`);
  await expect(page.getByText(profile.privateOwnerNote)).toBeVisible();
  await expect(page.getByRole('link', { name: profile.visited })).toBeVisible();
});

test('an unknown user has no profile', async ({ page }) => {
  await page.goto('/users/nobody_here_e2e');
  await expect(page.getByRole('heading', { name: en.notFound.title })).toBeVisible();
});
