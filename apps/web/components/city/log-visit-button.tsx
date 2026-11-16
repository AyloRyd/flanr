'use client';

import { CalendarPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { VisitForm } from '@/components/city/visit-form';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LogVisitButtonProps {
  cityId: number;
  cityName: string;
  /** The day the signed-in user registered, as YYYY-MM-DD; null for a guest (FR-AUTH-002). */
  registeredOn: string | null;
}

/** Opens the visit form (FR-VIS-001), or asks a guest to sign in first (FR-AUTH-002). */
export function LogVisitButton({ cityId, cityName, registeredOn }: LogVisitButtonProps) {
  const t = useTranslations('city');
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  function openForm() {
    setSaved(false);
    setOpen(true);
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button size="lg" className="rounded-full" onClick={openForm}>
        <CalendarPlus aria-hidden />
        {t('logVisit')}
      </Button>
      <p role="status" className="text-sm text-muted-foreground empty:hidden">
        {saved && t('visitSaved')}
      </p>

      {registeredOn === null ? (
        <SignInPrompt title={t('signInPrompt.visitTitle')} open={open} onOpenChange={setOpen} />
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('visitForm.title', { city: cityName })}</DialogTitle>
              <DialogDescription>{t('visitForm.description')}</DialogDescription>
            </DialogHeader>
            <VisitForm
              cityId={cityId}
              registeredOn={registeredOn}
              onSaved={() => {
                setOpen(false);
                setSaved(true);
              }}
              onCancel={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
