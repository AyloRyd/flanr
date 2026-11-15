import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AccountMenu } from '@/components/account-menu';
import { ThemeToggle } from '@/components/theme-toggle';

/** The bar at the top of every page. Navigation links join it as their pages are built. */
export function SiteHeader() {
  const t = useTranslations('app');

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-primary">
          {t('name')}
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
