'use client';

import {
  checkVisitDate,
  parseVisitDate,
  visitDateFromFields,
  type VisitDatePrecision,
} from '@flanr/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { logVisit, type VisitProblem } from '@/app/cities/[cityId]/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatVisitDateForDisplay, localToday } from '@/lib/visit-date';

/** The date precisions of BR-003, and "no date" for a visit before the registration (BR-002). */
type Precision = VisitDatePrecision | 'none';

const precisions: Precision[] = ['day', 'month', 'year', 'none'];

const months = Array.from({ length: 12 }, (_, index) => index + 1);

/** A problem the form finds itself, or one of the date rules the API checks too. */
type FormProblem = VisitProblem | 'incomplete';

interface VisitFormProps {
  cityId: number;
  /** The day the user registered, as YYYY-MM-DD. Visits after it need a date (BR-002). */
  registeredOn: string;
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * Logs a visit with a date of day, month or year precision, or without a date if the user
 * confirms that it was before their registration (FR-VIS-001…003). The hint explains the
 * recommended visit model (FR-VIS-008).
 */
export function VisitForm({ cityId, registeredOn, onSaved, onCancel }: VisitFormProps) {
  const t = useTranslations('city.visitForm');
  const format = useFormatter();
  const id = useId();
  const [precision, setPrecision] = useState<Precision>('day');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [beforeRegistration, setBeforeRegistration] = useState(false);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [pending, startTransition] = useTransition();

  const today = localToday();
  const registrationDate = formatVisitDateForDisplay(format, registeredOn);
  const monthName = (value: number) =>
    format.dateTime(new Date(Date.UTC(2000, value - 1, 1)), { month: 'long', timeZone: 'UTC' });

  /** The visit as the API takes it, or the problem that keeps it from being saved. */
  function readVisit():
    { visit: { date: string | null; beforeRegistration: boolean } } | { problem: FormProblem } {
    const date = precision === 'none' ? null : visitDateFromFields(precision, { day, month, year });
    if (precision !== 'none' && date === null) return { problem: 'incomplete' };

    const dateProblem = checkVisitDate(
      { date: date ? parseVisitDate(date) : null, beforeRegistration },
      { today, registeredOn },
    );
    if (dateProblem) return { problem: dateProblem };
    return { visit: { date, beforeRegistration: date === null } };
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = readVisit();
    if ('problem' in read) {
      setProblem(read.problem);
      return;
    }
    setProblem(null);
    startTransition(async () => {
      const result = await logVisit(cityId, read.visit);
      if (result.ok) onSaved();
      else setProblem(result.problem);
    });
  }

  const problemId = `${id}-problem`;
  const invalid = problem !== null && problem !== 'failed';
  const fieldProps = { 'aria-invalid': invalid || undefined, 'aria-describedby': problemId };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p id={`${id}-precision`} className="text-sm font-medium">
          {t('precision')}
        </p>
        <RadioGroup
          aria-labelledby={`${id}-precision`}
          value={precision}
          onValueChange={(value) => {
            setPrecision(value as Precision);
            setProblem(null);
          }}
          className="grid-cols-2 sm:grid-cols-4"
        >
          {precisions.map((value) => (
            <Label key={value} className="flex items-center gap-2 font-normal">
              <RadioGroupItem value={value} />
              {t(`precisionOption.${value}`)}
            </Label>
          ))}
        </RadioGroup>
      </div>

      {precision === 'day' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-day`}>{t('date')}</Label>
          <Input
            id={`${id}-day`}
            type="date"
            max={today}
            value={day}
            onChange={(event) => setDay(event.target.value)}
            {...fieldProps}
          />
        </div>
      )}

      {(precision === 'month' || precision === 'year') && (
        <div className="flex gap-3">
          {precision === 'month' && (
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor={`${id}-month`}>{t('month')}</Label>
              <NativeSelect
                id={`${id}-month`}
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                {...fieldProps}
              >
                <option value="">{t('chooseMonth')}</option>
                {months.map((value) => (
                  <option key={value} value={value}>
                    {monthName(value)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="flex w-28 flex-col gap-2">
            <Label htmlFor={`${id}-year`}>{t('year')}</Label>
            <Input
              id={`${id}-year`}
              type="number"
              inputMode="numeric"
              max={today.slice(0, 4)}
              value={year}
              onChange={(event) => setYear(event.target.value)}
              {...fieldProps}
            />
          </div>
        </div>
      )}

      {precision === 'none' && (
        <div className="flex flex-col gap-2">
          <Label className="flex items-start gap-2 font-normal leading-snug">
            <Checkbox
              checked={beforeRegistration}
              onCheckedChange={(checked) => setBeforeRegistration(checked === true)}
              className="mt-0.5"
              {...fieldProps}
            />
            {t('beforeRegistration', { date: registrationDate })}
          </Label>
          <p className="text-sm text-muted-foreground">{t('undatedNote')}</p>
        </div>
      )}

      <details className="rounded-lg bg-muted px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">{t('helpTitle')}</summary>
        <p className="mt-2 text-muted-foreground">{t('helpText')}</p>
      </details>

      <p id={problemId} role="alert" className="text-sm text-destructive empty:hidden">
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
