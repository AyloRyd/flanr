import { randomUUID } from 'node:crypto';
import { createClerkClient } from '@clerk/backend';
import { clerkKeys } from './clerk-env';

type ClerkClient = ReturnType<typeof createClerkClient>;

export interface ClerkTestUser {
  id: string;
  emailAddress: string;
}

/**
 * Creates a user in the Clerk development instance. The address uses Clerk's `+clerk_test`
 * form, which never receives mail.
 */
export async function createClerkTestUser(clerk: ClerkClient): Promise<ClerkTestUser> {
  const id = randomUUID().replaceAll('-', '').slice(0, 12);
  const emailAddress = `e2e-${id}+clerk_test@example.com`;
  const user = await clerk.users.createUser({
    emailAddress: [emailAddress],
    // The Clerk instance requires a username; this one also fits FR-PROF-001.
    username: `e2e_${id}`,
    skipPasswordRequirement: true,
  });
  return { id: user.id, emailAddress };
}

const clerkClient = () => createClerkClient({ secretKey: clerkKeys().secretKey });

/**
 * A user of its own for a test that changes the profile, deletes the account or needs a user
 * without any data, so that it never meets the other tests.
 */
export async function createFreshUser(): Promise<ClerkTestUser> {
  return createClerkTestUser(clerkClient());
}

/** Deletes a user; one the test deleted already is fine. */
export async function deleteClerkUser(userId: string, clerk: ClerkClient = clerkClient()) {
  try {
    await clerk.users.deleteUser(userId);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status !== 404) throw error;
  }
}
