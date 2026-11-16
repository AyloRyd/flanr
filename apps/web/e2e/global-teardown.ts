import { createClerkClient } from '@clerk/backend';
import { clerkKeys } from './clerk-env';
import { testUsers } from './users';

/** Deletes the users that global-setup.ts created. */
export default async function globalTeardown(): Promise<void> {
  const users = Object.values(testUsers()).filter((user) => user !== undefined);
  if (users.length === 0) return;
  const clerk = createClerkClient({ secretKey: clerkKeys().secretKey });
  for (const user of users) await clerk.users.deleteUser(user.id);
}
