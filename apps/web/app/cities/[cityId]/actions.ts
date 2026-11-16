'use server';

import { revalidatePath } from 'next/cache';
import { serverApi } from '@/lib/api';

export type PlanResult = { ok: true } | { ok: false; problem: 'visited' | 'failed' };

/**
 * Adds the city to the signed-in user's Planned list or removes it (FR-LIST-002). The API checks
 * the session and refuses a visited city (BR-004).
 */
export async function setPlanned(cityId: number, planned: boolean): Promise<PlanResult> {
  const api = serverApi();
  const path = { params: { path: { cityId } } };
  const { response } = planned
    ? await api.PUT('/v1/planned-cities/{cityId}', path)
    : await api.DELETE('/v1/planned-cities/{cityId}', path);

  // Removing a city that is no longer planned leaves the list as the user wanted it.
  const done = response.ok || (!planned && response.status === 404);
  if (done) {
    revalidatePath(`/cities/${cityId}`);
    return { ok: true };
  }
  return { ok: false, problem: response.status === 409 ? 'visited' : 'failed' };
}
