import { auth } from '@clerk/nextjs/server';
import type { UserMap } from '@flanr/shared';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { MapWorkspace } from '@/components/workspace/map-workspace';
import { serverApi } from '@/lib/api';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('workspace');
  return { title: t('title') };
}

/** The signed-in user's cities; null for a guest. */
async function loadWorkspaceData(): Promise<UserMap | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const { data, response } = await serverApi().GET('/v1/map-cities');
  if (!data) throw new Error(`The workspace could not be loaded: ${response.status}`);
  return data;
}

/**
 * The map workspace (FR-MAP-008). The map stays while the city panel of the pages below it
 * changes, and a change to the user's data refreshes this layout.
 */
export default async function MapLayout({ children }: { children: ReactNode }) {
  const data = await loadWorkspaceData();
  return <MapWorkspace data={data}>{children}</MapWorkspace>;
}
