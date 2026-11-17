'use client';

import { maxListNoteLength } from '@flanr/shared';
import { ArrowDown, ArrowUp, MessageSquare, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { updateEntry } from '@/lib/fresh-actions';

interface EntryControlsProps {
  listId: number;
  cityId: number;
  cityName: string;
  position: number;
  /** The number of entries in the list, so the last one cannot move down. */
  entryCount: number;
  note: string | null;
  /** While a move or removal is being saved. */
  pending: boolean;
  onMove: (position: number) => void;
  onRemove: () => void;
}

/** Moving, annotating and removing an entry of the owner's list (FR-LIST-004). */
export function EntryControls({
  listId,
  cityId,
  cityName,
  position,
  entryCount,
  note,
  pending,
  onMove,
  onRemove,
}: EntryControlsProps) {
  const t = useTranslations('lists.entry');
  const [editingNote, setEditingNote] = useState(false);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('moveUp', { city: cityName })}
        disabled={pending || position === 1}
        onClick={() => onMove(position - 1)}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('moveDown', { city: cityName })}
        disabled={pending || position === entryCount}
        onClick={() => onMove(position + 1)}
      >
        <ArrowDown aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('editNote', { city: cityName })}
        onClick={() => setEditingNote(true)}
      >
        <MessageSquare aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('remove', { city: cityName })}
        disabled={pending}
        onClick={onRemove}
      >
        <X aria-hidden />
      </Button>

      <Dialog open={editingNote} onOpenChange={setEditingNote}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('noteTitle', { city: cityName })}</DialogTitle>
          </DialogHeader>
          <NoteForm
            note={note}
            onSave={async (value) => {
              const result = await updateEntry(listId, cityId, { note: value });
              if (result.ok) setEditingNote(false);
              return result.ok;
            }}
            onCancel={() => setEditingNote(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NoteForm({
  note,
  onSave,
  onCancel,
}: {
  note: string | null;
  onSave: (note: string | null) => Promise<boolean>;
  onCancel: () => void;
}) {
  const t = useTranslations('lists.entry');
  const id = useId();
  const [value, setValue] = useState(note ?? '');
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setFailed(!(await onSave(value.trim() || null)));
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Label htmlFor={`${id}-note`}>{t('note')}</Label>
      <textarea
        id={`${id}-note`}
        value={value}
        maxLength={maxListNoteLength}
        rows={3}
        onChange={(event) => setValue(event.target.value)}
        className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
      />
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('failed')}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {t('saveNote')}
        </Button>
      </div>
    </form>
  );
}
