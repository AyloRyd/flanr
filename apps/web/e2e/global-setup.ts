import { randomUUID } from 'node:crypto';
import { createClerkClient } from '@clerk/backend';
import { clerkSetup } from '@clerk/testing/playwright';
import { clerkKeys } from './clerk-env';

/**
 * Gets a Clerk testing token, so that Clerk's bot protection lets the tests through, and creates
 * a user for the sign-in tests. Its address uses Clerk's `+clerk_test` form, which never receives
 * mail. The user is deleted again in global-teardown.ts.
 */
export default async function globalSetup(): Promise<void> {
  const { publishableKey, secretKey } = clerkKeys();
  await clerkSetup({ publishableKey, secretKey });

  const id = randomUUID().replaceAll('-', '').slice(0, 12);
  const emailAddress = `e2e-${id}+clerk_test@example.com`;
  const user = await createClerkClient({ secretKey }).users.createUser({
    emailAddress: [emailAddress],
    // The Clerk instance requires a username; this one also fits FR-PROF-001.
    username: `e2e_${id}`,
    skipPasswordRequirement: true,
  });
  // Workers inherit the environment of the global setup.
  process.env.E2E_USER_EMAIL = emailAddress;
  process.env.E2E_USER_ID = user.id;
}
