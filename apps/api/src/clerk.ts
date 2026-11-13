import { createClerkClient, verifyToken } from '@clerk/backend';
import { verifyWebhook } from '@clerk/backend/webhooks';
import type { AuthAccountRemover } from './accounts.ts';
import type { TokenVerifier } from './auth.ts';
import type { ClerkProfile } from './users.ts';

/** Verifies Clerk session tokens. Without a secret key no token is accepted. */
export function createClerkTokenVerifier(secretKey: string | undefined): TokenVerifier {
  return async (token) => {
    if (!secretKey) return null;
    try {
      const payload = await verifyToken(token, { secretKey });
      return payload.sub;
    } catch {
      return null;
    }
  };
}

/** Deletes accounts at Clerk (FR-AUTH-009). Without a secret key every deletion fails. */
export function createClerkAccountRemover(secretKey: string | undefined): AuthAccountRemover {
  const clerk = secretKey ? createClerkClient({ secretKey }) : null;
  return async (authProviderId) => {
    if (!clerk) throw new Error('CLERK_SECRET_KEY is not set: the account cannot be deleted');
    await clerk.users.deleteUser(authProviderId);
  };
}

export type UserEvent =
  { type: 'upsert'; profile: ClerkProfile } | { type: 'delete'; authProviderId: string };

/** Checks the signature of a Clerk webhook and returns the user change it reports, if any. */
export type WebhookReader = (request: Request) => Promise<UserEvent | null>;

export function createClerkWebhookReader(signingSecret: string | undefined): WebhookReader {
  return async (request) => {
    if (!signingSecret) throw new Error('Webhook signing secret is not configured');
    const event = await verifyWebhook(request, { signingSecret });
    if (event.type === 'user.created' || event.type === 'user.updated') {
      const { id, username, first_name, last_name, image_url } = event.data;
      const name = [first_name, last_name].filter(Boolean).join(' ');
      return {
        type: 'upsert',
        profile: {
          authProviderId: id,
          username: username ?? null,
          displayName: name || null,
          avatarUrl: image_url || null,
        },
      };
    }
    if (event.type === 'user.deleted' && event.data.id) {
      return { type: 'delete', authProviderId: event.data.id };
    }
    return null;
  };
}
