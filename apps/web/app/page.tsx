import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
        {t('title')}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">{t('lead')}</p>
      <p className="text-sm text-muted-foreground">{t('comingSoon')}</p>
    </section>
  );
}
