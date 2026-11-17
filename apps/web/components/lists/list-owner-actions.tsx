'use client';

import type { List } from '@flanr/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { ListDetailsForm } from '@/components/lists/list-details-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { deleteList, updateList } from '@/lib/fresh-actions';

/** Renaming, describing, hiding and deleting a list, for its owner (FR-LIST-003, FR-LIST-005). */
export function ListOwnerActions({ list, listsPath }: { list: List; listsPath: string }) {
  const t = useTranslations('lists');
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        {t('edit')}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => {
          setDeleteFailed(false);
          setDeleting(true);
        }}
      >
        {t('delete')}
      </Button>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('editTitle')}</DialogTitle>
          </DialogHeader>
          <ListDetailsForm
            initial={list}
            submitLabel={t('save')}
            onSubmit={async (details) => {
              const result = await updateList(list.id, details);
              if (result.ok) setEditing(false);
              return result.ok;
            }}
            onCancel={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('deleteTitle')}
        description={t('deleteText', { title: list.title })}
        confirmLabel={t('delete')}
        pending={pending}
        problem={deleteFailed ? t('deleteFailed') : null}
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteList(list.id);
            if (result.ok) router.push(listsPath);
            else setDeleteFailed(true);
          })
        }
      />
    </div>
  );
}
