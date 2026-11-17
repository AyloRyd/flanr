import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ProfileTabs } from '@/components/profile/profile-tabs';
import { loadCitySummaries } from '@/lib/city-summaries';
import { loadProfile, profilePath } from '@/lib/profile';

interface ProfileLayoutProps {
  params: Promise<{ username: string }>;
  children: ReactNode;
}

export async function generateMetadata({ params }: ProfileLayoutProps): Promise<Metadata> {
  const view = await loadProfile((await params).username);
  return view ? { title: `${view.profile.displayName} (@${view.profile.username})` } : {};
}

/**
 * A user's profile (FR-PROF-004). Open to everyone; a private profile shows its owner's name,
 * avatar, bio and public custom lists only (FR-PRIV-001). The owner always sees everything.
 */
export default async function ProfileLayout({ params, children }: ProfileLayoutProps) {
  const view = await loadProfile((await params).username);
  if (!view) notFound();
  const { profile, isOwner } = view;
  const homeCityId = profile.homeCityId;
  const homeCity =
    homeCityId === null ? null : ((await loadCitySummaries([homeCityId])).get(homeCityId) ?? null);
  const showsTravel = isOwner || !profile.isPrivate;

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <ProfileHeader profile={profile} isOwner={isOwner} homeCity={homeCity} />
      {showsTravel && <ProfileTabs basePath={profilePath(profile.username)} />}
      {children}
    </section>
  );
}
