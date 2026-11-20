import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';

/** Outside the site's route group, so it brings the header and footer itself. */
export default function NotFound() {
  const t = useTranslations('notFound');

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <section className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('text')}</p>
          <Button asChild>
            <Link href="/">{t('backHome')}</Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
