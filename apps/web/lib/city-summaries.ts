import { maxCitySummaryIds, type CitySummary } from '@flanr/shared';
import { serverApi } from '@/lib/api';

/**
 * The summaries of the given cities by ID, in as few requests as the API allows. Lists of a
 * user carry only city IDs (GET /v1/city-summaries).
 */
export async function loadCitySummaries(cityIds: number[]): Promise<Map<number, CitySummary>> {
  const ids = [...new Set(cityIds)];
  const chunks: number[][] = [];
  for (let start = 0; start < ids.length; start += maxCitySummaryIds) {
    chunks.push(ids.slice(start, start + maxCitySummaryIds));
  }
  const api = serverApi();
  const pages = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, response } = await api.GET('/v1/city-summaries', {
        params: { query: { ids: chunk.join(',') } },
      });
      if (!data) throw new Error(`City summaries could not be loaded: ${response.status}`);
      return data.items;
    }),
  );
  return new Map(pages.flat().map((city) => [city.id, city]));
}

/** Pages through a paginated endpoint until its end, for lists that are shown whole. */
export async function loadAllPages<T>(
  loadPage: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor: string | null }>,
  maxPages = 50,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await loadPage(cursor);
    items.push(...result.items);
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return items;
}
