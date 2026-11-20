'use server';

import { maxUndatedVisits, type CitySearchResult } from '@flanr/shared';
import { revalidatePath } from 'next/cache';
import { serverApi } from '@/lib/api';

/** Cities whose name starts with or resembles the text, for picking them (FR-SRCH-001). */
export async function findCities(text: string): Promise<CitySearchResult[]> {
  const q = text.trim();
  if (!q) return [];
  const { data } = await serverApi().GET('/v1/cities', { params: { query: { q, limit: 8 } } });
  return data?.items ?? [];
}

export interface PastVisits {
  cityId: number;
  /** All visits to the city, the dated one included. */
  count: number;
  /** The date of one of the visits, if the user knows it (BR-003). */
  date: string | null;
}

/**
 * Adds the visits of the onboarding (FR-VIS-007): one dated visit where the user gave a date,
 * and the rest as undated visits, which the user confirmed were before registering (BR-002).
 * Returns the cities that could not be saved.
 */
export async function savePastVisits(
  cities: PastVisits[],
  beforeRegistration: boolean,
): Promise<{ failedCityIds: number[] }> {
  const api = serverApi();
  const failedCityIds: number[] = [];
  for (const city of cities) {
    const undated = city.count - (city.date ? 1 : 0);
    let ok = true;
    if (city.date) {
      const { response } = await api.POST('/v1/visits', {
        body: { cityId: city.cityId, date: city.date, beforeRegistration: false },
      });
      ok = response.ok;
    }
    if (ok && undated > 0) {
      // Undated visits are added to those the user may have already.
      const path = { params: { path: { cityId: city.cityId } } };
      const current = await api.GET('/v1/cities/{cityId}/undated-visits', path);
      const count = Math.min(maxUndatedVisits, (current.data?.count ?? 0) + undated);
      const { response } = await api.PUT('/v1/cities/{cityId}/undated-visits', {
        ...path,
        body: { count, beforeRegistration, confirmRatingDeletion: false },
      });
      ok = current.response.ok && response.ok;
    }
    if (!ok) failedCityIds.push(city.cityId);
  }
  revalidatePath('/', 'layout');
  return { failedCityIds };
}
