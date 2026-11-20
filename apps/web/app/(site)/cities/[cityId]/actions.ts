'use server';

import {
  livedPeriodProblems,
  visitDateProblemMessages,
  type LivedPeriodProblem,
  type SetCityRating,
  type SetLivedCity,
  type Visit,
  type VisitDateProblem,
} from '@flanr/shared';
import { revalidatePath } from 'next/cache';
import { serverApi } from '@/lib/api';
import { loadAllPages } from '@/lib/city-summaries';

/**
 * A change to the user's data of a city shows on its page and in the map workspace, where the
 * city panel and the markers come from the map's layout.
 */
function refreshCity(cityId: number): void {
  revalidatePath(`/cities/${cityId}`);
  revalidatePath('/map', 'layout');
}

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
    refreshCity(cityId);
    return { ok: true };
  }
  return { ok: false, problem: response.status === 409 ? 'visited' : 'failed' };
}

export type VisitProblem = VisitDateProblem | 'failed';

/** The date of a new or changed visit, as the API takes it. */
export type VisitChange = { date: string | null; beforeRegistration: boolean };

export type LogVisitResult = { ok: true } | { ok: false; problem: VisitProblem };

/**
 * Logs a visit to the city for the signed-in user (FR-VIS-001…004). The form checks the date
 * first; the API checks it again against the user's registration date (BR-002, BR-003).
 */
export async function logVisit(cityId: number, visit: VisitChange): Promise<LogVisitResult> {
  const { response, error } = await serverApi().POST('/v1/visits', {
    body: { cityId, ...visit },
  });
  if (response.ok) {
    refreshCity(cityId);
    return { ok: true };
  }
  return { ok: false, problem: dateProblemOf(error?.errors) ?? 'failed' };
}

/** Which date rule the API names in a validation error, if any. */
function dateProblemOf(
  errors: { path: string; message: string }[] | undefined,
): VisitDateProblem | null {
  const message = errors?.find((entry) => entry.path === 'date')?.message;
  const problems = Object.entries(visitDateProblemMessages) as [VisitDateProblem, string][];
  return problems.find(([, text]) => text === message)?.[0] ?? null;
}

export type RatingProblem = 'not_visited' | 'failed';

export type SetRatingResult = { ok: true } | { ok: false; problem: RatingProblem };

/**
 * Rates the city for the signed-in user or replaces their rating (FR-RATE-001, FR-RATE-002,
 * BR-008). The API refuses a city the user has not visited (BR-005).
 */
export async function setRating(cityId: number, rating: SetCityRating): Promise<SetRatingResult> {
  const { response } = await serverApi().PUT('/v1/cities/{cityId}/rating', {
    params: { path: { cityId } },
    body: rating,
  });
  if (response.ok) {
    refreshCity(cityId);
    return { ok: true };
  }
  return { ok: false, problem: response.status === 409 ? 'not_visited' : 'failed' };
}

/** Changes the date of one of the user's visits (FR-VIS-006), checked like a new one (BR-002). */
export async function updateVisit(
  cityId: number,
  visitId: number,
  visit: VisitChange,
): Promise<LogVisitResult> {
  const { response, error } = await serverApi().PATCH('/v1/visits/{visitId}', {
    params: { path: { visitId } },
    body: visit,
  });
  if (response.ok) {
    refreshCity(cityId);
    return { ok: true };
  }
  return { ok: false, problem: dateProblemOf(error?.errors) ?? 'failed' };
}

export type RemovalResult =
  { ok: true } | { ok: false; problem: 'rating_needs_confirmation' | 'failed' };

/**
 * Deletes one of the user's visits (FR-VIS-006). If it is the last one to a rated city that is not
 * a lived-in city, the API deletes the rating too, but only with the confirmation (BR-005).
 */
export async function deleteVisit(
  cityId: number,
  visitId: number,
  confirmRatingDeletion: boolean,
): Promise<RemovalResult> {
  const { response } = await serverApi().DELETE('/v1/visits/{visitId}', {
    params: {
      path: { visitId },
      query: { confirmRatingDeletion: confirmRatingDeletion ? 'true' : 'false' },
    },
  });
  return removalResult(cityId, response);
}

/**
 * Sets the number of undated visits to the city (FR-VIS-005). Adding visits needs the
 * confirmation that they were before the registration (FR-VIS-003); removing the last visits to
 * a rated city needs the confirmation that the rating goes too (BR-005).
 */
export async function setUndatedVisits(
  cityId: number,
  count: number,
  confirm: { beforeRegistration: boolean; confirmRatingDeletion: boolean },
): Promise<RemovalResult> {
  const { response } = await serverApi().PUT('/v1/cities/{cityId}/undated-visits', {
    params: { path: { cityId } },
    body: { count, ...confirm },
  });
  return removalResult(cityId, response);
}

/** Deletes the user's rating of the city with its criteria ratings (FR-RATE-004). */
export async function deleteRating(cityId: number): Promise<RemovalResult> {
  const { response } = await serverApi().DELETE('/v1/cities/{cityId}/rating', {
    params: { path: { cityId } },
  });
  return removalResult(cityId, response);
}

/** A 404 means the thing is already gone, which is what the user asked for. */
function removalResult(cityId: number, response: Response): RemovalResult {
  if (response.ok || response.status === 404) {
    refreshCity(cityId);
    return { ok: true };
  }
  return {
    ok: false,
    problem: response.status === 409 ? 'rating_needs_confirmation' : 'failed',
  };
}

export type LivedProblem = LivedPeriodProblem | 'failed';

/**
 * Marks the city as the user's current or a past lived-in city, with an optional period
 * (FR-VIS-010, BR-016). A new current city makes the previous one a past one.
 */
export async function setLived(
  cityId: number,
  lived: SetLivedCity,
): Promise<{ ok: true } | { ok: false; problem: LivedProblem }> {
  const { response, error } = await serverApi().PUT('/v1/lived-cities/{cityId}', {
    params: { path: { cityId } },
    body: lived,
  });
  if (response.ok) {
    refreshCity(cityId);
    return { ok: true };
  }
  const message = error?.errors?.[0]?.message;
  const problems = Object.entries(livedPeriodProblems) as [
    LivedPeriodProblem,
    { message: string },
  ][];
  return {
    ok: false,
    problem: problems.find(([, problem]) => problem.message === message)?.[0] ?? 'failed',
  };
}

/**
 * Removes the lived-in mark (FR-VIS-010). Without visits to a rated city the rating goes too,
 * which needs the confirmation (BR-005).
 */
export async function removeLived(
  cityId: number,
  confirmRatingDeletion: boolean,
): Promise<RemovalResult> {
  const { response } = await serverApi().DELETE('/v1/lived-cities/{cityId}', {
    params: {
      path: { cityId },
      query: { confirmRatingDeletion: confirmRatingDeletion ? 'true' : 'false' },
    },
  });
  return removalResult(cityId, response);
}

/** All visits of the signed-in user to the city, newest first, for changing older ones too. */
export async function loadVisits(cityId: number): Promise<Visit[]> {
  const api = serverApi();
  return loadAllPages(async (cursor) => {
    const { data, response } = await api.GET('/v1/visits', {
      params: { query: { cityId, limit: 100, ...(cursor ? { cursor } : {}) } },
    });
    if (!data) throw new Error(`Visits could not be loaded: ${response.status}`);
    return data;
  });
}
