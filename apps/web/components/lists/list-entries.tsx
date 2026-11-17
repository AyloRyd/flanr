'use client';

import type { CitySummary, ListEntry } from '@flanr/shared';
import { useTranslations } from 'next-intl';
import { useOptimistic, useState, useTransition } from 'react';
import { CityListItem } from '@/components/city-list-item';
import { EntryControls } from '@/components/lists/entry-controls';
import { removeFromList, updateEntry } from '@/lib/fresh-actions';

export interface ShownEntry {
  entry: ListEntry;
  city: CitySummary;
}

type Change =
  { type: 'move'; cityId: number; position: number } | { type: 'remove'; cityId: number };

/** The entries after a move or a removal, numbered again from the first shown position. */
function applyChange(entries: ShownEntry[], change: Change): ShownEntry[] {
  const first = entries[0]?.entry.position ?? 1;
  const moved = entries.find((item) => item.entry.cityId === change.cityId);
  const rest = entries.filter((item) => item.entry.cityId !== change.cityId);
  if (change.type === 'move' && moved) {
    const index = Math.max(0, Math.min(rest.length, change.position - first));
    rest.splice(index, 0, moved);
  }
  return rest.map((item, index) => ({
    ...item,
    entry: { ...item.entry, position: first + index },
  }));
}

interface ListEntriesProps {
  listId: number;
  entries: ShownEntry[];
  /** All entries of the list, also those on other pages. */
  entryCount: number;
  isOwner: boolean;
}

/**
 * The cities of a list in their order (FR-LIST-004). Moves and removals by the owner show at
 * once and go back if the API refuses them.
 */
export function ListEntries({ listId, entries, entryCount, isOwner }: ListEntriesProps) {
  const t = useTranslations('lists');
  const [shown, change] = useOptimistic(entries, applyChange);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function apply(next: Change, save: () => Promise<{ ok: boolean }>) {
    setFailed(false);
    startTransition(async () => {
      change(next);
      if (!(await save()).ok) setFailed(true);
    });
  }

  return (
    <>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('entry.failed')}
        </p>
      )}
      <ol aria-label={t('entries')} className="divide-y">
        {shown.map(({ entry, city }) => (
          <CityListItem key={entry.cityId} city={city}>
            {entry.note && <p className="mt-1 text-sm whitespace-pre-line">{entry.note}</p>}
            {isOwner && (
              <EntryControls
                listId={listId}
                cityId={entry.cityId}
                cityName={city.name}
                position={entry.position}
                entryCount={entryCount}
                note={entry.note}
                pending={pending}
                onMove={(position) =>
                  apply({ type: 'move', cityId: entry.cityId, position }, () =>
                    updateEntry(listId, entry.cityId, { position }),
                  )
                }
                onRemove={() =>
                  apply({ type: 'remove', cityId: entry.cityId }, () =>
                    removeFromList(listId, entry.cityId),
                  )
                }
              />
            )}
          </CityListItem>
        ))}
      </ol>
    </>
  );
}
