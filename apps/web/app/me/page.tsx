import { redirect } from 'next/navigation';
import { loadCurrentUser, profilePath } from '@/lib/profile';

/** The signed-in user's own profile; guests are sent to sign in. */
export default async function MyProfilePage() {
  const me = await loadCurrentUser();
  redirect(me ? profilePath(me.username) : '/sign-in');
}
