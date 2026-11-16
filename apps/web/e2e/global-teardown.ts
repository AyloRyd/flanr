import { createClerkClient } from '@clerk/backend';
import { clerkKeys } from './clerk-env';

/** Deletes the user that global-setup.ts created. */
export default async function globalTeardown(): Promise<void> {
  const userId = process.env.E2E_USER_ID;
  if (!userId) return;
  await createClerkClient({ secretKey: clerkKeys().secretKey }).users.deleteUser(userId);
}
