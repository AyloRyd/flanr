import { auth } from '@clerk/nextjs/server';
import type { CityDetails, CommunityRating, OwnCityData, Visit } from '@flanr/shared';
import { cache } from 'react';
import { serverApi } from '@/lib/api';

/** The city and its community rating, or null if there is no such city. Read once per request. */
export const loadCity = cache(
  async (rawId: string): Promise<{ city: CityDetails; rating: CommunityRating } | null> => {
    // Only digits: anything else cannot be a city ID, and the API would answer 400.
    if (!/^[1-9]\d{0,8}$/.test(rawId)) return null;
    const cityId = Number(rawId);
    const api = serverApi();
    const path = { params: { path: { cityId } } };
    const [city, rating] = await Promise.all([
      api.GET('/v1/cities/{cityId}', path),
      api.GET('/v1/cities/{cityId}/community-rating', path),
    ]);
    if (city.response.status === 404) return null;
    if (!city.data || !rating.data) {
      throw new Error(`City ${cityId} could not be loaded: ${city.response.status}`);
    }
    return { city: city.data, rating: rating.data };
  },
);

/** How many dated visits the city page lists; the rest are counted. */
const shownVisits = 10;

export interface OwnData {
  data: OwnCityData;
  visits: Visit[];
  /** The day the user registered, as YYYY-MM-DD. Visits after it need a date (BR-002). */
  registeredOn: string;
  /** For the links to the user's own lists. */
  username: string;
}

/** The signed-in user's own data for the city and their newest visits; null for a guest. */
export async function loadOwnData(cityId: number): Promise<OwnData | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const api = serverApi();
  const [own, visits, me] = await Promise.all([
    api.GET('/v1/me/cities/{cityId}', { params: { path: { cityId } } }),
    api.GET('/v1/visits', { params: { query: { cityId, limit: shownVisits } } }),
    api.GET('/v1/me'),
  ]);
  if (!own.data || !visits.data || !me.data) {
    throw new Error(`Own data for city ${cityId} could not be loaded: ${own.response.status}`);
  }
  // The API takes the date of the registration in UTC as well.
  const registeredOn = me.data.registeredAt.slice(0, 10);
  return { data: own.data, visits: visits.data.items, registeredOn, username: me.data.username };
}
