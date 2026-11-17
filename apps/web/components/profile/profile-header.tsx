import type { CitySummary, PublicProfile } from '@flanr/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface ProfileHeaderProps {
  profile: PublicProfile;
  isOwner: boolean;
  /** The home location, when the user shows it (FR-PROF-003). */
  homeCity: CitySummary | null;
}

/** Who the profile belongs to (FR-PROF-002, FR-PROF-003), and whether it is private (FR-PRIV-001). */
export function ProfileHeader({ profile, isOwner, homeCity }: ProfileHeaderProps) {
  const t = useTranslations('profile');

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {profile.avatarUrl ? (
        <Image
          src={profile.avatarUrl}
          alt=""
          width={80}
          height={80}
          className="size-20 rounded-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex size-20 items-center justify-center rounded-full bg-secondary text-2xl font-semibold"
        >
          {profile.displayName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{profile.displayName}</h1>
        <p className="text-muted-foreground">@{profile.username}</p>
        {profile.bio && <p className="mt-2 max-w-2xl whitespace-pre-line">{profile.bio}</p>}
        {homeCity && (
          <p className="mt-1 text-sm">
            {t('livesIn')}{' '}
            <Link href={`/cities/${homeCity.id}`} className="underline-offset-4 hover:underline">
              {homeCity.name}
            </Link>
            , {homeCity.country.name}
          </p>
        )}
        {profile.isPrivate && (
          <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm">
            {isOwner ? t('privateOwnerNote') : t('privateNote')}
          </p>
        )}
      </div>
    </header>
  );
}
