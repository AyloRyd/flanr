import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { loadCurrentUser, profilePath } from '@/lib/profile';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('onboarding');
  return { title: t('title') };
}

/**
 * Quickly adds the cities a new user has already been to (FR-VIS-007). Offered after signing
 * up and from an empty Visited list; guests sign in first.
 */
export default async function OnboardingPage() {
  const user = await loadCurrentUser();
  if (!user) redirect('/sign-in');
  const t = await getTranslations('onboarding');

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('lead')}</p>
      </header>
      <OnboardingFlow
        registeredOn={user.registeredAt.slice(0, 10)}
        donePath={profilePath(user.username)}
      />
    </section>
  );
}
