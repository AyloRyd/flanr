import type { CitySearchResult } from '@flanr/shared';
import { CityListItem } from '@/components/city-list-item';

/** One city in the search results (FR-SRCH-002). */
export function CityResult({ city }: { city: CitySearchResult }) {
  const { matchedName, ...summary } = city;
  return <CityListItem city={summary} matchedName={matchedName} />;
}
