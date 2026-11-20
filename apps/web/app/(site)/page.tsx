import { auth } from '@clerk/nextjs/server';
import { Compass } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

const features = ['log', 'rate', 'map', 'calendar'] as const;

/**
 * The landing page for guests and search engines (SRS §6.1). It says what Flanr is and opens
 * the map; a signed-in user goes to the map straight away. Pictures of the product come later.
 */
export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect('/map');
  const t = await getTranslations('home');

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
        {t('title')}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">{t('lead')}</p>
      <Button size="lg" className="self-start" asChild>
        <Link href="/map">
          <Compass aria-hidden />
          {t('explore')}
        </Link>
      </Button>
      <ul className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <li key={feature} className="rounded-xl border p-4">
            <h2 className="font-semibold">{t(`features.${feature}.title`)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(`features.${feature}.text`)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
