'use server';

import { visitDateProblemMessages, type VisitDateProblem } from '@flanr/shared';
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

export type VisitProblem = VisitDateProblem | 'failed';

export type LogVisitResult = { ok: true } | { ok: false; problem: VisitProblem };

/**
 * Logs a visit to the city for the signed-in user (FR-VIS-001…004). The form checks the date
 * first; the API checks it again against the user's registration date (BR-002, BR-003).
 */
export async function logVisit(
  cityId: number,
  visit: { date: string | null; beforeRegistration: boolean },
): Promise<LogVisitResult> {
  const { response, error } = await serverApi().POST('/v1/visits', {
    body: { cityId, ...visit },
  });
  if (response.ok) {
    revalidatePath(`/cities/${cityId}`);
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
