import type { CityRating } from '@flanr/shared';
import { serverApi } from '@/lib/api';
import { loadAllPages } from '@/lib/city-summaries';

/** How many cities a page of a profile list shows. */
export const profilePageSize = 50;

/** A cursor from the URL of a profile page, if there is one. */
export function cursorOf(params: Record<string, string | string[] | undefined>) {
  const value = params.cursor;
  return typeof value === 'string' && value ? { cursor: value } : {};
}

/**
 * All ratings of the user by city, to show them in the Visited list (FR-PROF-004). The owner
 * reads their own; anyone else reads those of a public profile.
 */
export async function loadRatingsByCity(
  username: string,
  isOwner: boolean,
): Promise<Map<number, CityRating>> {
  const api = serverApi();
  const ratings = await loadAllPages(async (cursor) => {
    const query = { limit: 100, ...(cursor ? { cursor } : {}) };
    const { data, response } = isOwner
      ? await api.GET('/v1/ratings', { params: { query } })
      : await api.GET('/v1/users/{username}/ratings', {
          params: { path: { username }, query },
        });
    if (!data) throw new Error(`Ratings could not be loaded: ${response.status}`);
    return data;
  });
  return new Map(ratings.map((rating) => [rating.cityId, rating]));
}
