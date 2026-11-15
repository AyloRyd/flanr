import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** The Clerk keys of the development instance: from the root .env locally, from secrets in CI. */
export function clerkKeys(): { publishableKey: string; secretKey: string } {
  const rootEnv = resolve(import.meta.dirname, '../../../.env');
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!publishableKey || !secretKey) {
    throw new Error(
      'End-to-end tests need NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY of a Clerk development instance.',
    );
  }
  if (!secretKey.startsWith('sk_test_')) {
    throw new Error(
      'End-to-end tests create users, so they only run against a development instance.',
    );
  }
  return { publishableKey, secretKey };
}
