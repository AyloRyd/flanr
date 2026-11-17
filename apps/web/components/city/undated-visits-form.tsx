'use client';

import { maxUndatedVisits } from '@flanr/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { setUndatedVisits } from '@/app/cities/[cityId]/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatVisitDateForDisplay } from '@/lib/visit-date';

type FormProblem = 'invalid' | 'date_required' | 'rating_needs_confirmation' | 'failed';

interface UndatedVisitsFormProps {
  cityId: number;
  /** The number of undated visits now. */
  current: number;
  /** The dated visits, which the form does not change. */
  datedCount: number;
  /** Whether the rating depends on the visits: the city is rated and not a lived-in city. */
  ratingNeedsVisits: boolean;
  /** The day the user registered, as YYYY-MM-DD. */
  registeredOn: string;
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * Sets the number of undated visits directly (FR-VIS-005). More visits need the confirmation
 * that they were before the registration (FR-VIS-003). If no visit would be left, the user is
 * told that the rating goes too, and saving confirms it (BR-005).
 */
export function UndatedVisitsForm({
  cityId,
  current,
  datedCount,
  ratingNeedsVisits,
  registeredOn,
  onSaved,
  onCancel,
}: UndatedVisitsFormProps) {
  const t = useTranslations('city.undatedForm');
  const format = useFormatter();
  const id = useId();
  const [count, setCount] = useState(String(current));
  const [beforeRegistration, setBeforeRegistration] = useState(false);
  // Set when the API says the rating would go, which the page did not know yet.
  const [ratingConfirmed, setRatingConfirmed] = useState(false);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [pending, startTransition] = useTransition();

  const newCount = /^\d+$/.test(count) ? Number(count) : null;
  const adding = newCount !== null && newCount > current;
  const takesRating =
    ratingConfirmed || (ratingNeedsVisits && newCount === 0 && datedCount === 0 && current > 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newCount === null || newCount > maxUndatedVisits) {
      setProblem('invalid');
      return;
    }
    if (adding && !beforeRegistration) {
      setProblem('date_required');
      return;
    }
    if (newCount === current) {
      onCancel();
      return;
    }
    setProblem(null);
    startTransition(async () => {
      const result = await setUndatedVisits(cityId, newCount, {
        beforeRegistration: adding,
        confirmRatingDeletion: takesRating,
      });
      if (result.ok) {
        onSaved();
        return;
      }
      if (result.problem === 'rating_needs_confirmation') setRatingConfirmed(true);
      setProblem(result.problem);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-count`}>{t('count')}</Label>
        <Input
          id={`${id}-count`}
          type="number"
          inputMode="numeric"
          min={0}
          max={maxUndatedVisits}
          className="w-28"
          value={count}
          onChange={(event) => {
            setCount(event.target.value);
            setProblem(null);
          }}
          aria-invalid={problem === 'invalid' || undefined}
          aria-describedby={`${id}-problem`}
        />
      </div>

      {adding && (
        <Label className="flex items-start gap-2 leading-snug font-normal">
          <Checkbox
            checked={beforeRegistration}
            onCheckedChange={(checked) => setBeforeRegistration(checked === true)}
            className="mt-0.5"
            aria-invalid={problem === 'date_required' || undefined}
          />
          {t('beforeRegistration', { date: formatVisitDateForDisplay(format, registeredOn) })}
        </Label>
      )}

      {takesRating && <p className="text-sm font-medium text-destructive">{t('ratingGoes')}</p>}

      <p id={`${id}-problem`} role="alert" className="text-sm text-destructive empty:hidden">
        {problem && problem !== 'rating_needs_confirmation' && t(`problem.${problem}`)}
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" variant={takesRating ? 'destructive' : 'default'} disabled={pending}>
          {takesRating ? t('saveAndDeleteRating') : t('save')}
        </Button>
      </div>
    </form>
  );
}
