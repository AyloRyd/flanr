import { useTranslations } from 'next-intl';
import { TabLinks } from '@/components/tab-links';

/** Switches between searching cities and lists, keeping the search text. */
export function SearchTabs({ current, q }: { current: 'cities' | 'lists'; q: string }) {
  const t = useTranslations('search');
  const query = q ? `?${new URLSearchParams({ q }).toString()}` : '';
  return (
    <TabLinks
      label={t('kind')}
      current={current}
      tabs={[
        { key: 'cities', href: `/search${query}`, label: t('cities') },
        { key: 'lists', href: `/search/lists${query}`, label: t('lists') },
      ]}
    />
  );
}
