import { UserMapView } from '@/components/map/user-map';
import { serverApi } from '@/lib/api';
import { readMapView } from '@/lib/map/view-state';
import { loadProfile } from '@/lib/profile';
import type { SearchParams } from '@/lib/search-params';

interface MapPageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<SearchParams>;
}

/**
 * The map of a profile (FR-MAP-005…007): the owner's personal map, and the same map with the
 * same modes for everyone else. A private profile has none for others (FR-PRIV-001).
 */
export default async function MapPage({ params, searchParams }: MapPageProps) {
  const { username } = await params;
  const view = await loadProfile(username);
  if (!view) return null;
  const { profile, isOwner } = view;
  // The header already says that the profile is private (FR-PRIV-001).
  if (profile.isPrivate && !isOwner) return null;

  const api = serverApi();
  const { data, response } = isOwner
    ? await api.GET('/v1/map-cities')
    : await api.GET('/v1/users/{username}/map-cities', {
        params: { path: { username: profile.username } },
      });
  if (!data) throw new Error(`The map could not be loaded: ${response.status}`);

  return (
    <UserMapView
      data={data}
      ownerName={isOwner ? null : profile.displayName}
      initialView={readMapView(await searchParams)}
    />
  );
}
