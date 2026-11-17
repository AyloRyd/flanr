import { auth } from '@clerk/nextjs/server';
import type { CurrentUser, PublicProfile } from '@flanr/shared';
import { cache } from 'react';
import { serverApi } from '@/lib/api';

/** The signed-in user, or null for a guest. Read once per request. */
export const loadCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const { userId } = await auth();
  if (!userId) return null;
  const { data, response } = await serverApi().GET('/v1/me');
  if (!data) throw new Error(`The signed-in user could not be loaded: ${response.status}`);
  return data;
});

export interface ProfileView {
  profile: PublicProfile;
  /** The signed-in user looks at their own profile: they see everything and can change it. */
  isOwner: boolean;
}

/** A profile as the visitor sees it, or null if there is no such user. Read once per request. */
export const loadProfile = cache(async (username: string): Promise<ProfileView | null> => {
  const [me, { data, response }] = await Promise.all([
    loadCurrentUser(),
    serverApi().GET('/v1/users/{username}', { params: { path: { username } } }),
  ]);
  if (response.status === 404 || response.status === 400) return null;
  if (!data) throw new Error(`Profile ${username} could not be loaded: ${response.status}`);
  // Usernames do not depend on letter case (FR-PROF-001).
  const isOwner = me !== null && me.username.toLowerCase() === data.username.toLowerCase();
  return { profile: data, isOwner };
});

/** The path of a profile, or of one of its parts. */
export const profilePath = (username: string, part = '') =>
  `/users/${encodeURIComponent(username)}${part}`;
