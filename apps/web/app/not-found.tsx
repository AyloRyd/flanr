import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const t = useTranslations('notFound');

  return (
    <section className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-muted-foreground">{t('text')}</p>
      <Button asChild>
        <Link href="/">{t('backHome')}</Link>
      </Button>
    </section>
  );
}
