'use client';

import { Show, SignInButton, UserButton } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/**
 * Sign in for guests, the account menu for signed-in users. Clerk's menu has the account
 * settings, where the email address is changed (FR-AUTH-008), and signing out (FR-AUTH-007).
 * A client component, so that it changes as soon as the user signs in or out; on the server
 * Clerk renders it with the session of the request.
 */
export function AccountMenu() {
  const t = useTranslations('auth');

  return (
    <>
      <Show when="signed-out">
        {/* Clerk returns the user to the page they were on after signing in. */}
        <SignInButton mode="redirect">
          <Button variant="outline" className="rounded-full">
            {t('signIn')}
          </Button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}
