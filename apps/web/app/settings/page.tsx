import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AccountSettings } from '@/components/settings/account-settings';
import { PrivacySettingsForm } from '@/components/settings/privacy-settings-form';
import { ProfileSettingsForm } from '@/components/settings/profile-settings-form';
import { loadCitySummaries } from '@/lib/city-summaries';
import { loadCurrentUser, profilePath } from '@/lib/profile';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

/** The profile, privacy and account settings of the signed-in user; guests sign in first. */
export default async function SettingsPage() {
  const user = await loadCurrentUser();
  if (!user) redirect('/sign-in');
  const t = await getTranslations('settings');
  const homeCityId = user.homeCityId;
  const homeCity =
    homeCityId === null ? null : ((await loadCitySummaries([homeCityId])).get(homeCityId) ?? null);

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <Link
          href={profilePath(user.username)}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t('viewProfile')}
        </Link>
      </header>
      <SettingsSection id="settings-profile" title={t('profileTitle')}>
        <ProfileSettingsForm user={user} />
      </SettingsSection>
      <SettingsSection id="settings-privacy" title={t('privacyTitle')}>
        <PrivacySettingsForm user={user} homeCity={homeCity} />
      </SettingsSection>
      <SettingsSection id="settings-account" title={t('accountTitle')}>
        <AccountSettings username={user.username} />
      </SettingsSection>
    </section>
  );
}

function SettingsSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t pt-6">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
