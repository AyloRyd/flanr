import type { CityDetails } from '@flanr/shared';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

/**
 * The known facts of a city. A fact that is not known is left out instead of being shown empty
 * (FR-CITY-001, FR-CITY-002).
 */
export function CityFacts({ city }: { city: CityDetails }) {
  const t = useTranslations('city');
  const format = useFormatter();
  const number = (value: number, digits = 0) =>
    format.number(value, { maximumFractionDigits: digits });

  const facts: [label: string, value: ReactNode][] = [];
  if (city.population !== null) {
    const population = number(city.population);
    facts.push([
      t('population'),
      city.populationYear === null
        ? population
        : t('populationYear', { population, year: String(city.populationYear) }),
    ]);
  }
  if (city.areaKm2 !== null) {
    facts.push([t('area'), t('areaValue', { area: number(city.areaKm2, 1) })]);
  }
  if (city.population !== null && city.areaKm2) {
    facts.push([
      t('density'),
      t('densityValue', { density: number(city.population / city.areaKm2) }),
    ]);
  }
  if (city.elevationM !== null) {
    facts.push([t('elevation'), t('elevationValue', { elevation: number(city.elevationM) })]);
  }
  if (city.founded !== null) facts.push([t('founded'), String(city.founded)]);

  if (facts.length === 0) return null;
  return (
    <section aria-labelledby="facts" className="rounded-2xl border p-6">
      <h2 id="facts" className="text-lg font-semibold">
        {t('facts')}
      </h2>
      <dl className="mt-3 grid gap-4 sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-lg font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
