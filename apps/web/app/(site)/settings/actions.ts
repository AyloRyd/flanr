'use server';

import type { Visibility } from '@flanr/shared';
import { revalidatePath } from 'next/cache';
import { serverApi } from '@/lib/api';

/** What the settings change; only the given fields change (PATCH /v1/me). */
export interface ProfileChange {
  username?: string;
  displayName?: string;
  bio?: string | null;
  homeCityVisible?: boolean;
  profileVisibility?: Visibility;
}

export type ProfileProblem = 'username_taken' | 'invalid' | 'failed';

/**
 * Changes the profile or the privacy settings (FR-PROF-001…003, FR-PRIV-001). The API checks
 * the username again and refuses one that is taken.
 */
export async function updateProfile(
  change: ProfileChange,
): Promise<{ ok: true } | { ok: false; problem: ProfileProblem }> {
  const { response } = await serverApi().PATCH('/v1/me', { body: change });
  if (response.ok) {
    revalidatePath('/', 'layout');
    return { ok: true };
  }
  if (response.status === 409) return { ok: false, problem: 'username_taken' };
  return { ok: false, problem: response.status === 400 ? 'invalid' : 'failed' };
}

/**
 * Deletes the account with all its data, at the sign-in provider too (FR-AUTH-009). The user
 * confirmed it in the settings; the browser signs out afterwards.
 */
export async function deleteAccount(): Promise<{ ok: boolean }> {
  const { response } = await serverApi().DELETE('/v1/me', {
    params: { query: { confirm: 'true' } },
  });
  return { ok: response.ok };
}
