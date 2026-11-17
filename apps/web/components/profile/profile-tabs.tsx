'use client';

import { useSelectedLayoutSegment } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TabLinks } from '@/components/tab-links';

/** The parts of a profile: the Visited list, the map, the Planned list and the custom lists. */
export function ProfileTabs({ basePath }: { basePath: string }) {
  const t = useTranslations('profile');
  const segment = useSelectedLayoutSegment();

  return (
    <TabLinks
      label={t('parts')}
      current={segment ?? 'visited'}
      tabs={[
        { key: 'visited', href: basePath, label: t('visited') },
        { key: 'map', href: `${basePath}/map`, label: t('map') },
        { key: 'planned', href: `${basePath}/planned`, label: t('planned') },
        { key: 'lists', href: `${basePath}/lists`, label: t('lists') },
      ]}
    />
  );
}
