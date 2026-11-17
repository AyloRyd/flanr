'use client';

import type { List } from '@flanr/shared';
import { ListPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addToList, createList, loadMyLists, removeFromList } from '@/lib/fresh-actions';

interface AddToListButtonProps {
  cityId: number;
  cityName: string;
  /** The lists that contain the city now. */
  listIds: number[];
}

/**
 * Puts the city into the user's custom lists or takes it out, and creates a new list for it
 * (FR-LIST-003, FR-LIST-004). Any city can be in a custom list, visited or not.
 */
export function AddToListButton({ cityId, cityName, listIds }: AddToListButtonProps) {
  const t = useTranslations('lists.add');
  const id = useId();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<List[] | null>(null);
  const [contained, setContained] = useState(() => new Set(listIds));
  const [newTitle, setNewTitle] = useState('');
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setOpen(true);
    setFailed(false);
    setContained(new Set(listIds));
    startTransition(async () => {
      try {
        setLists(await loadMyLists());
      } catch {
        setLists([]);
        setFailed(true);
      }
    });
  }

  /** Adds the list to or takes it from the ticked ones. */
  function mark(listId: number, add: boolean) {
    setContained((current) => {
      const next = new Set(current);
      if (add) next.add(listId);
      else next.delete(listId);
      return next;
    });
  }

  /** The tick shows at once and goes back if the change fails. */
  function toggle(listId: number, add: boolean) {
    setFailed(false);
    mark(listId, add);
    startTransition(async () => {
      const result = add ? await addToList(listId, cityId) : await removeFromList(listId, cityId);
      // A city that is already in the list is where the user wanted it.
      const done = result.ok || result.problem === 'already_in_list';
      if (!done) {
        mark(listId, !add);
        setFailed(true);
      }
    });
  }

  function createAndAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setFailed(false);
    startTransition(async () => {
      const created = await createList({ title, description: null, visibility: 'public' });
      if (!created.ok || !(await addToList(created.list.id, cityId)).ok) {
        setFailed(true);
        return;
      }
      setLists((current) => [created.list, ...(current ?? [])]);
      setContained((current) => new Set(current).add(created.list.id));
      setNewTitle('');
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog}>
        <ListPlus aria-hidden />
        {t('button')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('title', { city: cityName })}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          {lists === null ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : lists.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noLists')}</p>
          ) : (
            <ul aria-label={t('yourLists')} className="flex flex-col gap-3">
              {lists.map((list) => (
                <li key={list.id}>
                  <Label className="flex items-center gap-2 font-normal">
                    <Checkbox
                      checked={contained.has(list.id)}
                      onCheckedChange={(checked) => toggle(list.id, checked === true)}
                    />
                    {list.title}
                  </Label>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={createAndAdd} className="flex flex-col gap-2 border-t pt-4">
            <Label htmlFor={`${id}-new`}>{t('newList')}</Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-new`}
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder={t('newListPlaceholder')}
              />
              <Button type="submit" variant="outline" disabled={pending || !newTitle.trim()}>
                {t('create')}
              </Button>
            </div>
          </form>

          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t('failed')}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
