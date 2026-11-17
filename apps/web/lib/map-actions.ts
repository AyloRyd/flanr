'use server';

import type { CitySummary } from '@flanr/shared';
import { serverApi } from '@/lib/api';

/** The name, place and community rating of a city, for the preview on the map (FR-MAP-004). */
export async function loadCityPreview(cityId: number): Promise<CitySummary | null> {
  const { data } = await serverApi().GET('/v1/city-summaries', {
    params: { query: { ids: String(cityId) } },
  });
  return data?.items[0] ?? null;
}
