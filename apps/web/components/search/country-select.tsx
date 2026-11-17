'use client';

import type { Country } from '@flanr/shared';
import { useTranslations } from 'next-intl';
import { NativeSelect } from '@/components/ui/native-select';

/**
 * The country filter. Choosing a country sends the form at once, so that the region filter
 * shows that country's regions; a region of the previous country is dropped.
 */
export function CountrySelect({
  id,
  countries,
  defaultValue,
}: {
  id: string;
  countries: Country[];
  defaultValue: string;
}) {
  const t = useTranslations('search.filters');

  return (
    <NativeSelect
      id={id}
      name="country"
      defaultValue={defaultValue}
      onChange={(event) => {
        const form = event.currentTarget.form;
        const region = form?.elements.namedItem('regionId');
        if (region instanceof HTMLSelectElement) region.value = '';
        form?.requestSubmit();
      }}
    >
      <option value="">{t('anyCountry')}</option>
      {countries.map((country) => (
        <option key={country.code} value={country.code}>
          {country.name}
        </option>
      ))}
    </NativeSelect>
  );
}
