'use client';

import type { OwnCityData, Visit } from '@flanr/shared';
import { Pencil, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { deleteVisit } from '@/app/cities/[cityId]/actions';
import { UndatedVisitsForm } from '@/components/city/undated-visits-form';
import { VisitForm } from '@/components/city/visit-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatVisitDateForDisplay } from '@/lib/visit-date';

type Status = 'visitChanged' | 'visitDeleted' | 'undatedChanged';

interface OwnVisitsProps {
  cityId: number;
  data: OwnCityData;
  /** The newest dated visits. */
  visits: Visit[];
  /** The day the user registered, as YYYY-MM-DD. */
  registeredOn: string;
}

/**
 * The user's visits to the city, with changing and deleting dated visits (FR-VIS-006) and
 * setting the number of undated ones (FR-VIS-005). Deleting the last visit to a rated city
 * that is not a lived-in city deletes the rating too, after a warning (BR-005).
 */
export function OwnVisits({ cityId, data, visits, registeredOn }: OwnVisitsProps) {
  const t = useTranslations('city');
  const format = useFormatter();
  const date = (value: string) => formatVisitDateForDisplay(format, value);
  const [editing, setEditing] = useState<Visit | null>(null);
  const [deleting, setDeleting] = useState<Visit | null>(null);
  const [undatedOpen, setUndatedOpen] = useState(false);
  // Set when the API says the rating would go, which the page did not know yet.
  const [ratingConfirmed, setRatingConfirmed] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();

  const datedVisits = visits.filter((visit) => visit.date !== null);
  const datedCount = data.visitCount - data.undatedVisitCount;
  const moreDated = datedCount - datedVisits.length;
  const ratingNeedsVisits = data.rating !== null && data.lived === null;
  const deletionTakesRating = ratingConfirmed || (ratingNeedsVisits && data.visitCount === 1);

  function startDeleting(visit: Visit) {
    setRatingConfirmed(false);
    setDeleteFailed(false);
    setDeleting(visit);
  }

  function confirmDeletion() {
    if (!deleting) return;
    const visitId = deleting.id;
    startTransition(async () => {
      const result = await deleteVisit(cityId, visitId, deletionTakesRating);
      if (result.ok) {
        setDeleting(null);
        setStatus('visitDeleted');
      } else if (result.problem === 'rating_needs_confirmation') {
        // The dialog now says that the rating goes too; the next click confirms it.
        setRatingConfirmed(true);
      } else {
        setDeleteFailed(true);
      }
    });
  }

  const deletingDate = deleting?.date ? date(deleting.date) : '';

  return (
    <div className="mt-4">
      <p className="font-medium">{t('visits', { count: data.visitCount })}</p>
      {datedVisits.length > 0 && (
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {datedVisits.map((visit) => {
            const shown = visit.date ? date(visit.date) : '';
            return (
              <li key={visit.id} className="flex items-center justify-between gap-2">
                <span>{shown}</span>
                <span className="flex">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('ownVisits.edit', { date: shown })}
                    onClick={() => setEditing(visit)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('ownVisits.delete', { date: shown })}
                    onClick={() => startDeleting(visit)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </span>
              </li>
            );
          })}
          {moreDated > 0 && <li>{t('moreVisits', { count: moreDated })}</li>}
        </ul>
      )}
      {data.undatedVisitCount > 0 && (
        <div className="mt-1 flex items-center justify-between gap-2 text-muted-foreground">
          <span>{t('undatedVisits', { count: data.undatedVisitCount })}</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            aria-label={t('ownVisits.changeUndatedLabel')}
            onClick={() => setUndatedOpen(true)}
          >
            {t('ownVisits.changeUndated')}
          </Button>
        </div>
      )}
      <p role="status" className="mt-2 text-sm text-muted-foreground empty:hidden">
        {status && t(`ownVisits.status.${status}`)}
      </p>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ownVisits.editTitle')}</DialogTitle>
            <DialogDescription>{t('visitForm.description')}</DialogDescription>
          </DialogHeader>
          {editing && (
            <VisitForm
              cityId={cityId}
              registeredOn={registeredOn}
              visit={editing}
              onSaved={() => {
                setEditing(null);
                setStatus('visitChanged');
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={undatedOpen} onOpenChange={setUndatedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('undatedForm.title')}</DialogTitle>
            <DialogDescription>{t('undatedForm.description')}</DialogDescription>
          </DialogHeader>
          <UndatedVisitsForm
            cityId={cityId}
            current={data.undatedVisitCount}
            datedCount={datedCount}
            ratingNeedsVisits={ratingNeedsVisits}
            registeredOn={registeredOn}
            onSaved={() => {
              setUndatedOpen(false);
              setStatus('undatedChanged');
            }}
            onCancel={() => setUndatedOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('ownVisits.deleteTitle')}
        description={
          deletionTakesRating
            ? t('ownVisits.deleteWithRating', { date: deletingDate })
            : t('ownVisits.deleteText', { date: deletingDate })
        }
        confirmLabel={
          deletionTakesRating ? t('ownVisits.deleteVisitAndRating') : t('ownVisits.deleteVisit')
        }
        onConfirm={confirmDeletion}
        pending={pending}
        problem={deleteFailed ? t('ownVisits.deleteFailed') : null}
      />
    </div>
  );
}
