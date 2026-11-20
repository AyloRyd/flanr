import { PublicLists } from '@/components/profile/public-lists';
import { loadProfile } from '@/lib/profile';
import type { SearchParams } from '@/lib/search-params';

interface ListsPageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<SearchParams>;
}

/** The custom lists of a profile (FR-LIST-003, FR-LIST-006). */
export default async function ListsPage({ params, searchParams }: ListsPageProps) {
  const view = await loadProfile((await params).username);
  if (!view) return null;
  const cursor = (await searchParams).cursor;
  return (
    <PublicLists
      username={view.profile.username}
      isOwner={view.isOwner}
      {...(typeof cursor === 'string' && cursor ? { cursor } : {})}
    />
  );
}
