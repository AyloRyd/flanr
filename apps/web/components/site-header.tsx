import { Search } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AccountMenu } from '@/components/account-menu';
import { ThemeToggle } from '@/components/theme-toggle';

/** The bar at the top of every page. Navigation links join it as their pages are built. */
export function SiteHeader() {
  const t = useTranslations('app');
  const tNav = useTranslations('nav');

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-primary">
          {t('name')}
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/search"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Search aria-hidden className="size-4" />
            {tNav('search')}
          </Link>
          <ThemeToggle />
          <AccountMenu />
        </nav>
      </div>
    </header>
  );
}
