'use client';

import {
  ratingScaleValues,
  suggestedSubjectiveRating,
  type CityRating,
  type Criterion,
} from '@flanr/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { setRating, type RatingProblem } from '@/app/cities/[cityId]/actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

type FormProblem = RatingProblem | 'subjective_required';

interface RatingFormProps {
  cityId: number;
  /** The criteria that can be rated, in display order. */
  criteria: Criterion[];
  /** The user's rating of the city, if they have one: the form changes it (BR-008). */
  rating: CityRating | null;
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * Rates any of the criteria and gives the subjective rating (FR-RATE-001, FR-RATE-002). Until
 * the user picks a subjective rating themselves, it follows the criteria average rounded to the
 * nearest 0.5 (FR-RATE-003, BR-007).
 */
export function RatingForm({ cityId, criteria, rating, onSaved, onCancel }: RatingFormProps) {
  const t = useTranslations('city.ratingForm');
  const format = useFormatter();
  const id = useId();
  // Select values are strings; an empty one means "not rated".
  const [criteriaValues, setCriteriaValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(rating?.criteria ?? {}).map(([key, value]) => [key, String(value)]),
    ),
  );
  const [chosenSubjective, setChosenSubjective] = useState(
    rating ? String(rating.subjective) : null,
  );
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [pending, startTransition] = useTransition();

  const ratedCriteria = Object.fromEntries(
    criteria.flatMap(({ key }) =>
      criteriaValues[key] ? [[key, Number(criteriaValues[key])]] : [],
    ),
  );
  const suggested = suggestedSubjectiveRating(Object.values(ratedCriteria));
  const subjective = chosenSubjective ?? (suggested === null ? '' : String(suggested));
  const number = (value: number) => format.number(value, { maximumFractionDigits: 1 });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subjective) {
      setProblem('subjective_required');
      return;
    }
    setProblem(null);
    startTransition(async () => {
      const result = await setRating(cityId, {
        subjective: Number(subjective),
        criteria: ratedCriteria,
      });
      if (result.ok) onSaved();
      else setProblem(result.problem);
    });
  }

  const scaleOptions = ratingScaleValues.map((value) => (
    <option key={value} value={String(value)}>
      {number(value)}
    </option>
  ));

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">{t('criteria')}</legend>
        <p className="-mt-1 text-sm text-muted-foreground">{t('criteriaNote')}</p>
        {criteria.map((criterion) => (
          <div key={criterion.key} className="flex items-center justify-between gap-4">
            <Label htmlFor={`${id}-${criterion.key}`} className="font-normal">
              {criterion.name}
            </Label>
            <NativeSelect
              id={`${id}-${criterion.key}`}
              className="w-36"
              value={criteriaValues[criterion.key] ?? ''}
              onChange={(event) =>
                setCriteriaValues((values) => ({ ...values, [criterion.key]: event.target.value }))
              }
            >
              <option value="">{t('notRated')}</option>
              {scaleOptions}
            </NativeSelect>
          </div>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2 border-t pt-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor={`${id}-subjective`}>{t('subjective')}</Label>
          <NativeSelect
            id={`${id}-subjective`}
            className="w-36"
            value={subjective}
            onChange={(event) => {
              setChosenSubjective(event.target.value);
              setProblem(null);
            }}
            aria-invalid={problem === 'subjective_required' || undefined}
            aria-describedby={`${id}-suggested ${id}-problem`}
          >
            <option value="">{t('choose')}</option>
            {scaleOptions}
          </NativeSelect>
        </div>
        <div id={`${id}-suggested`} className="flex items-center justify-end gap-2 text-sm">
          {suggested !== null && (
            <>
              <span className="text-muted-foreground">
                {t('suggested', { value: number(suggested) })}
              </span>
              {subjective !== String(suggested) && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => setChosenSubjective(String(suggested))}
                >
                  {t('useSuggested')}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <p id={`${id}-problem`} role="alert" className="text-sm text-destructive empty:hidden">
        {problem && t(`problem.${problem}`)}
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
