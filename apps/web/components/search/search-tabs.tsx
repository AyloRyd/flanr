import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/** Switches between searching cities and lists, keeping the search text. */
export function SearchTabs({ current, q }: { current: 'cities' | 'lists'; q: string }) {
  const t = useTranslations('search');
  const query = q ? `?${new URLSearchParams({ q }).toString()}` : '';
  const tabs = [
    { key: 'cities', href: `/search${query}`, label: t('cities') },
    { key: 'lists', href: `/search/lists${query}`, label: t('lists') },
  ] as const;

  return (
    <nav aria-label={t('kind')} className="flex gap-1 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
            tab.key === current
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
