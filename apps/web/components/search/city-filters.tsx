import {
  citySorts,
  ratingScaleValues,
  settlementTypes,
  type Country,
  type Region,
} from '@flanr/shared';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CountrySelect } from '@/components/search/country-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { CitySearchFields } from '@/lib/search-params';

interface CityFiltersProps {
  fields: CitySearchFields;
  countries: Country[];
  /** The regions of the chosen country; empty without one. */
  regions: Region[];
  open: boolean;
}

/** Filters and sorting of the city search (FR-SRCH-003). Part of the search form. */
export function CityFilters({ fields, countries, regions, open }: CityFiltersProps) {
  const t = useTranslations('search.filters');
  const clearHref = fields.q
    ? `/search?${new URLSearchParams({ q: fields.q }).toString()}`
    : '/search';
  // Relevance is the order of the name search and needs a search text.
  const sorts = citySorts.filter((sort) => sort !== 'relevance' || fields.q);

  return (
    <details open={open} className="rounded-2xl border px-4 py-3">
      <summary className="cursor-pointer font-medium">{t('title')}</summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-sort">{t('sort')}</Label>
          <NativeSelect id="filter-sort" name="sort" defaultValue={fields.sort}>
            <option value="">{t('sortDefault')}</option>
            {sorts.map((sort) => (
              <option key={sort} value={sort}>
                {t(`sortBy.${sort}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-order">{t('order')}</Label>
          <NativeSelect id="filter-order" name="order" defaultValue={fields.order}>
            <option value="">{t('orderDefault')}</option>
            <option value="desc">{t('orderDesc')}</option>
            <option value="asc">{t('orderAsc')}</option>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-country">{t('country')}</Label>
          <CountrySelect id="filter-country" countries={countries} defaultValue={fields.country} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-region">{t('region')}</Label>
          <NativeSelect
            id="filter-region"
            name="regionId"
            defaultValue={fields.regionId}
            disabled={regions.length === 0}
          >
            <option value="">
              {regions.length === 0 ? t('chooseCountryFirst') : t('anyRegion')}
            </option>
            {[1, 2].map((level) => {
              const ofLevel = regions.filter((region) => region.level === level);
              return (
                ofLevel.length > 0 && (
                  <optgroup key={level} label={t(level === 1 ? 'regionLevel1' : 'regionLevel2')}>
                    {ofLevel.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </optgroup>
                )
              );
            })}
          </NativeSelect>
        </div>

        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">{t('settlementType')}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {settlementTypes.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="settlementType"
                  value={type}
                  defaultChecked={fields.settlementType.includes(type)}
                  className="size-4 accent-primary"
                />
                {t(`settlementTypes.${type}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-3 sm:col-span-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="filter-population-min">{t('populationMin')}</Label>
            <Input
              id="filter-population-min"
              name="populationMin"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={fields.populationMin}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="filter-population-max">{t('populationMax')}</Label>
            <Input
              id="filter-population-max"
              name="populationMax"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={fields.populationMax}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-min-rating">{t('minRating')}</Label>
          <NativeSelect id="filter-min-rating" name="minRating" defaultValue={fields.minRating}>
            <option value="">{t('anyRating')}</option>
            {ratingScaleValues.map((value) => (
              <option key={value} value={String(value)}>
                {value}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-min-ratings">{t('minRatings')}</Label>
          <Input
            id="filter-min-ratings"
            name="minRatings"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={fields.minRatings}
            aria-describedby="filter-min-ratings-hint"
          />
        </div>
        <p id="filter-min-ratings-hint" className="text-sm text-muted-foreground sm:col-span-2">
          {t('minRatingsHint')}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit">{t('apply')}</Button>
        <Link href={clearHref} className="text-sm underline-offset-4 hover:underline">
          {t('clear')}
        </Link>
      </div>
    </details>
  );
}
