import { clerk } from '@clerk/testing/playwright';
import type { CurrentUser } from '@flanr/shared';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import en from '../messages/en.json' with { type: 'json' };
import type { ClerkTestUser } from './fresh-user';
import { expect, test } from './test';
import { fetchApiAsUser } from './users';

const settings = en.settings;

/** Signs in the test's own user and returns their Flanr username. */
async function signInFresh(page: Page, user: ClerkTestUser): Promise<string> {
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.emailAddress });
  await clerk.loaded({ page });
  const response = await fetchApiAsUser(page, 'GET', '/v1/me');
  return ((await response.json()) as CurrentUser).username;
}

const uniqueUsername = () => `u_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

test('the settings change the username, display name and bio (FR-PROF-001, FR-PROF-002)', async ({
  page,
  freshUser,
}) => {
  const oldUsername = await signInFresh(page, freshUser);
  await page.getByRole('button', { name: /open user menu/i }).click();
  await page.getByRole('button', { name: en.auth.settings }).click();
  await expect(page.getByRole('heading', { level: 1, name: settings.title })).toBeVisible();

  const profile = page.getByRole('region', { name: settings.profileTitle });
  const username = uniqueUsername();
  await profile.getByRole('textbox', { name: settings.profile.username }).fill(username);
  await profile.getByRole('textbox', { name: settings.profile.displayName }).fill('Ada Traveller');
  await profile.getByRole('textbox', { name: settings.profile.bio }).fill('Trams and old towns.');
  await profile.getByRole('button', { name: settings.profile.save }).click();
  await expect(profile.getByRole('status')).toHaveText(settings.profile.saved);

  await page.goto(`/users/${username}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ada Traveller');
  await expect(page.getByText('Trams and old towns.')).toBeVisible();
  // The old address does not redirect (FR-PROF-001 AC2).
  await page.goto(`/users/${oldUsername}`);
  await expect(page.getByRole('heading', { name: en.notFound.title })).toBeVisible();
});

test('a taken, reserved or too short username is refused (FR-PROF-001)', async ({
  page,
  freshUser,
}) => {
  await signInFresh(page, freshUser);
  await page.goto('/settings');
  const profile = page.getByRole('region', { name: settings.profileTitle });
  const username = profile.getByRole('textbox', { name: settings.profile.username });
  const save = profile.getByRole('button', { name: settings.profile.save });
  const alert = profile.getByRole('alert');

  await username.fill('ab');
  await save.click();
  await expect(alert).toHaveText(settings.profile.problem.username_length);
  await username.fill('admin');
  await save.click();
  await expect(alert).toHaveText(settings.profile.problem.username_reserved);
  // rater_0 is a user of the test data; usernames do not depend on letter case (AC3).
  await username.fill('Rater_0');
  await save.click();
  await expect(alert).toHaveText(settings.profile.problem.username_taken);
});

test('a private profile shows others only the name and public lists (FR-PRIV-001)', async ({
  page,
  browser,
  freshUser,
}) => {
  const username = await signInFresh(page, freshUser);
  await page.goto('/settings');
  const privacy = page.getByRole('region', { name: settings.privacyTitle });
  await privacy.getByRole('radio', { name: new RegExp(`^${settings.privacy.private}`) }).check();
  await privacy.getByRole('button', { name: settings.privacy.save }).click();
  await expect(privacy.getByRole('status')).toHaveText(settings.privacy.saved);

  const guest = await browser.newPage();
  await guest.goto(`/users/${username}`);
  await expect(guest.getByText(en.profile.privateNote)).toBeVisible();
  await guest.close();
});

test('the data export downloads everything as JSON (NFR-GDPR-003)', async ({ page, freshUser }) => {
  const username = await signInFresh(page, freshUser);
  await page.goto('/settings');

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: settings.account.export }).click();
  const file = await download;

  expect(file.suggestedFilename()).toMatch(/^flanr-export-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await readFile(await file.path(), 'utf8')) as {
    profile: { username: string };
  };
  expect(data.profile.username).toBe(username);
});

test('a user deletes their account after typing the username (FR-AUTH-009)', async ({
  page,
  freshUser,
}) => {
  const username = await signInFresh(page, freshUser);
  await page.goto('/settings');
  await page.getByRole('button', { name: settings.account.delete }).click();

  const dialog = page.getByRole('alertdialog', { name: settings.account.confirmTitle });
  const confirm = dialog.getByRole('button', { name: settings.account.confirmDelete });
  await expect(confirm).toBeDisabled();
  await dialog
    .getByRole('textbox', { name: settings.account.typeUsername.replace('{username}', username) })
    .fill(username);
  await confirm.click();

  // Signed out on the home page, and the profile is gone.
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: en.auth.signIn })).toBeVisible();
  await page.goto(`/users/${username}`);
  await expect(page.getByRole('heading', { name: en.notFound.title })).toBeVisible();
});
