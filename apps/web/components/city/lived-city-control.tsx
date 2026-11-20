'use client';

import {
  checkLivedPeriod,
  parseVisitDate,
  type LivedPeriodProblem,
  type OwnCityData,
} from '@flanr/shared';
import { Home } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition, type FormEvent } from 'react';
import type { LivedProblem } from '@/app/(site)/cities/[cityId]/actions';
import { removeLived, setLived } from '@/lib/fresh-actions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { localToday } from '@/lib/visit-date';

type FormProblem = LivedProblem | 'invalid_from' | 'invalid_to';

interface LivedCityControlProps {
  cityId: number;
  cityName: string;
  data: OwnCityData;
}

/**
 * Marks the city as one the user lives or lived in, with an optional period, or removes the
 * mark (FR-VIS-010, BR-016). Removing it from a rated city without visits takes the rating
 * with it, after a warning (BR-005).
 */
export function LivedCityControl({ cityId, cityName, data }: LivedCityControlProps) {
  const t = useTranslations('city.lived');
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [ratingConfirmed, setRatingConfirmed] = useState(false);
  const [removeFailed, setRemoveFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const takesRating = ratingConfirmed || (data.rating !== null && data.visitCount === 0);

  function confirmRemoval() {
    startTransition(async () => {
      const result = await removeLived(cityId, takesRating);
      if (result.ok) {
        setRemoving(false);
        setOpen(false);
      } else if (result.problem === 'rating_needs_confirmation') {
        setRatingConfirmed(true);
      } else {
        setRemoveFailed(true);
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Home aria-hidden />
        {data.lived ? t('change') : t('mark')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('title', { city: cityName })}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>
          <LivedForm
            cityId={cityId}
            lived={data.lived}
            onSaved={() => setOpen(false)}
            onCancel={() => setOpen(false)}
            onRemove={
              data.lived
                ? () => {
                    setRatingConfirmed(false);
                    setRemoveFailed(false);
                    setRemoving(true);
                  }
                : null
            }
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={t('removeTitle')}
        description={takesRating ? t('removeWithRating') : t('removeText')}
        confirmLabel={takesRating ? t('removeAndRating') : t('remove')}
        onConfirm={confirmRemoval}
        pending={pending}
        problem={removeFailed ? t('problem.failed') : null}
      />
    </>
  );
}

interface LivedFormProps {
  cityId: number;
  lived: OwnCityData['lived'];
  onSaved: () => void;
  onCancel: () => void;
  /** Null when the city has no mark to remove. */
  onRemove: (() => void) | null;
}

function LivedForm({ cityId, lived, onSaved, onCancel, onRemove }: LivedFormProps) {
  const t = useTranslations('city.lived');
  const id = useId();
  const [current, setCurrent] = useState(lived ? lived.isCurrent : true);
  const [from, setFrom] = useState(lived?.from ?? '');
  const [to, setTo] = useState(lived?.to ?? '');
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fromDate = from.trim() ? parseVisitDate(from.trim()) : null;
    // The city one lives in now has no end (BR-016).
    const toDate = !current && to.trim() ? parseVisitDate(to.trim()) : null;
    if (from.trim() && !fromDate) return setProblem('invalid_from');
    if (!current && to.trim() && !toDate) return setProblem('invalid_to');
    const periodProblem: LivedPeriodProblem | null = checkLivedPeriod(
      { isCurrent: current, from: fromDate, to: toDate },
      localToday(),
    );
    if (periodProblem) return setProblem(periodProblem);

    setProblem(null);
    startTransition(async () => {
      const result = await setLived(cityId, {
        isCurrent: current,
        from: fromDate ? from.trim() : null,
        to: toDate ? to.trim() : null,
      });
      if (result.ok) onSaved();
      else setProblem(result.problem);
    });
  }

  const problemId = `${id}-problem`;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <RadioGroup
        aria-label={t('when')}
        value={current ? 'current' : 'past'}
        onValueChange={(value) => setCurrent(value === 'current')}
      >
        <Label className="flex items-center gap-2 font-normal">
          <RadioGroupItem value="current" />
          {t('current')}
        </Label>
        <Label className="flex items-center gap-2 font-normal">
          <RadioGroupItem value="past" />
          {t('past')}
        </Label>
      </RadioGroup>
      {current && <p className="-mt-2 text-sm text-muted-foreground">{t('currentNote')}</p>}

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor={`${id}-from`}>{t('from')}</Label>
          <Input
            id={`${id}-from`}
            value={from}
            placeholder={t('datePlaceholder')}
            onChange={(event) => setFrom(event.target.value)}
            aria-describedby={`${id}-format ${problemId}`}
          />
        </div>
        {!current && (
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={`${id}-to`}>{t('to')}</Label>
            <Input
              id={`${id}-to`}
              value={to}
              placeholder={t('datePlaceholder')}
              onChange={(event) => setTo(event.target.value)}
              aria-describedby={`${id}-format ${problemId}`}
            />
          </div>
        )}
      </div>
      <p id={`${id}-format`} className="-mt-3 text-sm text-muted-foreground">
        {t('dateFormat')}
      </p>

      <p id={problemId} role="alert" className="text-sm text-destructive empty:hidden">
        {problem && t(`problem.${problem}`)}
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        {onRemove && (
          <Button type="button" variant="destructive" className="sm:mr-auto" onClick={onRemove}>
            {t('remove')}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
      </div>
    </form>
  );
}
