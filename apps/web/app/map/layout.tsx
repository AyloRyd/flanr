import { auth } from '@clerk/nextjs/server';
import type { TripCalendar, UserMap } from '@flanr/shared';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { MapWorkspace } from '@/components/workspace/map-workspace';
import { serverApi } from '@/lib/api';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('workspace');
  return { title: t('title') };
}

/** The signed-in user's cities and trip calendar; null for a guest. */
async function loadWorkspaceData(): Promise<{ map: UserMap; calendar: TripCalendar } | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const api = serverApi();
  const [map, calendar] = await Promise.all([
    api.GET('/v1/map-cities'),
    api.GET('/v1/trip-calendar'),
  ]);
  if (!map.data || !calendar.data) {
    throw new Error(`The workspace could not be loaded: ${map.response.status}`);
  }
  return { map: map.data, calendar: calendar.data };
}

/**
 * The map workspace (FR-MAP-008). The map stays while the city panel of the pages below it
 * changes, and a change to the user's data refreshes this layout.
 */
export default async function MapLayout({ children }: { children: ReactNode }) {
  const data = await loadWorkspaceData();
  return (
    <MapWorkspace data={data?.map ?? null} calendar={data?.calendar ?? null}>
      {children}
    </MapWorkspace>
  );
}
