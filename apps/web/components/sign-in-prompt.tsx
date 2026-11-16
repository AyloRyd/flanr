'use client';

import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SignInPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Offered to a guest who tries to change something (FR-AUTH-002). Clerk brings the user back to
 * the page they were on after signing in or up.
 */
export function SignInPrompt({ open, onOpenChange }: SignInPromptProps) {
  const t = useTranslations('city.signInPrompt');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('text')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <SignUpButton mode="redirect">
            <Button variant="outline">{t('signUp')}</Button>
          </SignUpButton>
          <SignInButton mode="redirect">
            <Button>{t('signIn')}</Button>
          </SignInButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
