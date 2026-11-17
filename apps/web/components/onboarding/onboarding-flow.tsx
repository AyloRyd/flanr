'use client';

import {
  checkVisitDate,
  maxUndatedVisits,
  parseVisitDate,
  type CitySearchResult,
} from '@flanr/shared';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useId, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PastVisits } from '@/app/onboarding/actions';
import { findCities, savePastVisits } from '@/lib/fresh-actions';
import { formatVisitDateForDisplay, localToday } from '@/lib/visit-date';

interface PickedCity {
  city: CitySearchResult;
  count: string;
  date: string;
}

type Problem =
  'none_picked' | 'invalid_count' | 'invalid_date' | 'date_in_future' | 'confirm' | 'failed';

interface OnboardingFlowProps {
  /** The day the user registered, as YYYY-MM-DD. */
  registeredOn: string;
  /** Where the user goes when they are done: their profile. */
  donePath: string;
}

/**
 * Adds cities the user visited before joining, with the number of visits and, if known, the
 * date of one of them (FR-VIS-007). Visits without a date need the confirmation that they were
 * before the registration (FR-VIS-003).
 */
export function OnboardingFlow({ registeredOn, donePath }: OnboardingFlowProps) {
  const t = useTranslations('onboarding');
  const tVisit = useTranslations('city.visitForm');
  const format = useFormatter();
  const router = useRouter();
  const id = useId();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<CitySearchResult[]>([]);
  const [picked, setPicked] = useState<PickedCity[]>([]);
  const [beforeRegistration, setBeforeRegistration] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [failedNames, setFailedNames] = useState<string[]>([]);
  const [saving, startSaving] = useTransition();

  // Searches a moment after the user stops typing.
  useEffect(() => {
    const text = query.trim();
    if (!text) return;
    let current = true;
    const timer = setTimeout(async () => {
      const cities = await findCities(text);
      if (current) setFound(cities);
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  function pick(city: CitySearchResult) {
    setPicked((list) =>
      list.some((item) => item.city.id === city.id)
        ? list
        : [...list, { city, count: '1', date: '' }],
    );
    setQuery('');
    setFound([]);
  }

  function change(cityId: number, field: 'count' | 'date', value: string) {
    setPicked((list) =>
      list.map((item) => (item.city.id === cityId ? { ...item, [field]: value } : item)),
    );
  }

  function save() {
    if (picked.length === 0) return setProblem('none_picked');
    const today = localToday();
    const cities: PastVisits[] = [];
    let undated = 0;
    for (const item of picked) {
      const count = /^\d+$/.test(item.count) ? Number(item.count) : 0;
      if (count < 1 || count > maxUndatedVisits) return setProblem('invalid_count');
      const date = item.date.trim();
      const parsed = date ? parseVisitDate(date) : null;
      if (date && !parsed) return setProblem('invalid_date');
      if (
        parsed &&
        checkVisitDate({ date: parsed, beforeRegistration: false }, { today, registeredOn })
      ) {
        return setProblem('date_in_future');
      }
      undated += count - (parsed ? 1 : 0);
      cities.push({ cityId: item.city.id, count, date: parsed ? date : null });
    }
    if (undated > 0 && !beforeRegistration) return setProblem('confirm');

    setProblem(null);
    startSaving(async () => {
      const { failedCityIds } = await savePastVisits(cities, beforeRegistration);
      if (failedCityIds.length === 0) {
        router.push(donePath);
        return;
      }
      // Keep only what failed, so the user can try those again.
      setPicked((list) => list.filter((item) => failedCityIds.includes(item.city.id)));
      setFailedNames(
        picked.filter((item) => failedCityIds.includes(item.city.id)).map((item) => item.city.name),
      );
      setProblem('failed');
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-search`}>{t('searchLabel')}</Label>
        <Input
          id={`${id}-search`}
          type="search"
          value={query}
          autoComplete="off"
          placeholder={t('searchPlaceholder')}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!event.target.value.trim()) setFound([]);
          }}
          className="h-10"
        />
        {query.trim() && found.length > 0 && (
          <ul aria-label={t('found')} className="divide-y rounded-lg border">
            {found.map((city) => (
              <li key={city.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="font-medium">{city.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {[city.municipality, city.region, city.country.name].filter(Boolean).join(', ')}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={t('add', { city: city.name })}
                  onClick={() => pick(city)}
                >
                  {t('addShort')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {picked.length > 0 && (
        <ul aria-label={t('picked')} className="flex flex-col gap-3">
          {picked.map((item) => (
            <li
              key={item.city.id}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-end"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.city.name}</p>
                <p className="text-sm text-muted-foreground">
                  {[item.city.region, item.city.country.name].filter(Boolean).join(', ')}
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex w-24 flex-col gap-1">
                  <Label htmlFor={`${id}-${item.city.id}-count`} className="text-sm">
                    {t('count')}
                  </Label>
                  <Input
                    id={`${id}-${item.city.id}-count`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={maxUndatedVisits}
                    value={item.count}
                    aria-label={t('countOf', { city: item.city.name })}
                    onChange={(event) => change(item.city.id, 'count', event.target.value)}
                  />
                </div>
                <div className="flex w-40 flex-col gap-1">
                  <Label htmlFor={`${id}-${item.city.id}-date`} className="text-sm">
                    {t('date')}
                  </Label>
                  <Input
                    id={`${id}-${item.city.id}-date`}
                    value={item.date}
                    placeholder={t('datePlaceholder')}
                    aria-label={t('dateOf', { city: item.city.name })}
                    onChange={(event) => change(item.city.id, 'date', event.target.value)}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('remove', { city: item.city.name })}
                onClick={() =>
                  setPicked((list) => list.filter((other) => other.city.id !== item.city.id))
                }
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {picked.length > 0 && <p className="text-sm text-muted-foreground">{t('dateHint')}</p>}

      <Label className="flex items-start gap-2 leading-snug font-normal">
        <Checkbox
          checked={beforeRegistration}
          onCheckedChange={(checked) => setBeforeRegistration(checked === true)}
          className="mt-0.5"
        />
        {t('beforeRegistration', { date: formatVisitDateForDisplay(format, registeredOn) })}
      </Label>

      <details className="rounded-lg bg-muted px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">{tVisit('helpTitle')}</summary>
        <p className="mt-2 text-muted-foreground">{tVisit('helpText')}</p>
      </details>

      <p role="alert" className="text-sm text-destructive empty:hidden">
        {problem && t(`problem.${problem}`, { cities: failedNames.join(', ') })}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push(donePath)}>
          {t('skip')}
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {t('save', { count: picked.length })}
        </Button>
      </div>
    </div>
  );
}
