import { randomUUID } from 'node:crypto';
import { createClerkClient } from '@clerk/backend';
import { clerkSetup } from '@clerk/testing/playwright';
import { clerkKeys } from './clerk-env';
import { seedE2eDatabase } from './database';
import {
  projectNames,
  testUserKey,
  testUsersVariable,
  type TestUserPurpose,
  type TestUsers,
} from './users';

/**
 * Seeds the database of the test API with the test cities. Gets a Clerk testing token, so that
 * Clerk's bot protection lets the tests through, and creates users for each Playwright project in
 * the Clerk development instance, so that projects running at the same time do not change each
 * other's data. The addresses use Clerk's `+clerk_test` form, which never receives mail. The users
 * are deleted again in global-teardown.ts.
 */
export default async function globalSetup(): Promise<void> {
  await seedE2eDatabase();

  const { publishableKey, secretKey } = clerkKeys();
  await clerkSetup({ publishableKey, secretKey });

  const clerk = createClerkClient({ secretKey });
  const users: TestUsers = {};
  const purposes: TestUserPurpose[] = ['main', 'signOut', 'private'];
  for (const project of projectNames) {
    for (const purpose of purposes) {
      const id = randomUUID().replaceAll('-', '').slice(0, 12);
      const emailAddress = `e2e-${id}+clerk_test@example.com`;
      const user = await clerk.users.createUser({
        emailAddress: [emailAddress],
        // The Clerk instance requires a username; this one also fits FR-PROF-001.
        username: `e2e_${id}`,
        skipPasswordRequirement: true,
      });
      users[testUserKey(project, purpose)] = { id: user.id, emailAddress };
    }
  }
  // Workers inherit the environment of the global setup.
  process.env[testUsersVariable] = JSON.stringify(users);
}
