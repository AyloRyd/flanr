'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ListDetailsForm } from '@/components/lists/list-details-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createListAndOpen } from '@/lib/fresh-actions';

/** Creates a custom list and opens it (FR-LIST-003). New lists are public (FR-LIST-005). */
export function NewListButton({ listsPath }: { listsPath: string }) {
  const t = useTranslations('lists');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {t('new')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('newTitle')}</DialogTitle>
          </DialogHeader>
          <ListDetailsForm
            initial={{ title: '', description: null, visibility: 'public' }}
            submitLabel={t('create')}
            // Only returns when the list could not be created; otherwise it opens the new list.
            onSubmit={async (details) => (await createListAndOpen(details, listsPath)).ok}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
