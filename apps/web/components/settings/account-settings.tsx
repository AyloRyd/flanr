'use client';

import { useClerk } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteAccount } from '@/lib/fresh-actions';

/**
 * Sign-in methods and email address, which Clerk manages (FR-AUTH-008), the data export
 * (NFR-GDPR-003) and deleting the account (FR-AUTH-009).
 */
export function AccountSettings({ username }: { username: string }) {
  const t = useTranslations('settings.account');
  const clerk = useClerk();
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState('');
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirmed = typed.trim().toLowerCase() === username.toLowerCase();

  function confirmDeletion() {
    if (!confirmed) return;
    setFailed(false);
    startTransition(async () => {
      const result = await deleteAccount();
      if (!result.ok) {
        setFailed(true);
        return;
      }
      // The account no longer exists, so Clerk may not answer the sign-out; it gets a moment,
      // then a full load of the home page drops what is left of the session in the browser.
      await Promise.race([
        clerk.signOut().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, on purpose.
      window.location.assign('/');
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        <p>{t('signInText')}</p>
        <Button variant="outline" onClick={() => clerk.openUserProfile()}>
          {t('manage')}
        </Button>
      </div>

      <div className="flex flex-col items-start gap-2">
        <h3 className="font-medium">{t('exportTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('exportText')}</p>
        <Button variant="outline" asChild>
          <a href="/settings/export" download>
            {t('export')}
          </a>
        </Button>
      </div>

      <div className="flex flex-col items-start gap-2">
        <h3 className="font-medium text-destructive">{t('deleteTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('deleteText')}</p>
        <Button
          variant="destructive"
          onClick={() => {
            setTyped('');
            setFailed(false);
            setDeleting(true);
          }}
        >
          {t('delete')}
        </Button>
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('confirmTitle')}
        description={t('confirmText')}
        confirmLabel={t('confirmDelete')}
        onConfirm={confirmDeletion}
        pending={pending || !confirmed}
        problem={failed ? t('failed') : null}
      >
        <Label htmlFor="delete-account-username" className="font-normal">
          {t('typeUsername', { username })}
        </Label>
        <Input
          id="delete-account-username"
          value={typed}
          autoComplete="off"
          onChange={(event) => setTyped(event.target.value)}
        />
      </ConfirmDialog>
    </div>
  );
}
