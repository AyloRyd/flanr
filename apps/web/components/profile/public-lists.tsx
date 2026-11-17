import type { List } from '@flanr/shared';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { NewListButton } from '@/components/lists/new-list-button';
import { MoreLink } from '@/components/profile/more-link';
import { serverApi } from '@/lib/api';
import { profilePath } from '@/lib/profile';
import { profilePageSize } from '@/lib/profile-lists';

interface PublicListsProps {
  username: string;
  /** The owner sees their private lists too and can create lists (FR-LIST-003, FR-LIST-005). */
  isOwner?: boolean;
  cursor?: string;
}

/**
 * The custom lists of a profile. Others see only the public ones, also on a private profile
 * (FR-LIST-006, FR-PRIV-001).
 */
export async function PublicLists({ username, isOwner = false, cursor }: PublicListsProps) {
  const t = await getTranslations('lists');
  const query = { limit: profilePageSize, ...(cursor ? { cursor } : {}) };
  const api = serverApi();
  const page = isOwner
    ? await api.GET('/v1/lists', { params: { query } })
    : await api.GET('/v1/users/{username}/lists', { params: { path: { username }, query } });
  if (!page.data) throw new Error(`Lists could not be loaded: ${page.response.status}`);
  const listsPath = profilePath(username, '/lists');

  return (
    <div className="flex flex-col gap-4">
      {isOwner && (
        <div>
          <NewListButton listsPath={listsPath} />
        </div>
      )}
      {page.data.items.length === 0 ? (
        <p className="text-muted-foreground">{isOwner ? t('noneOwn') : t('none')}</p>
      ) : (
        <ul aria-label={t('heading')} className="divide-y">
          {page.data.items.map((list) => (
            <ListRow key={list.id} list={list} href={`${listsPath}/${list.id}`} isOwner={isOwner} />
          ))}
        </ul>
      )}
      <MoreLink path={listsPath} cursor={page.data.nextCursor} />
    </div>
  );
}

async function ListRow({ list, href, isOwner }: { list: List; href: string; isOwner: boolean }) {
  const t = await getTranslations('lists');
  return (
    <li className="py-3">
      <Link href={href} className="font-medium underline-offset-4 hover:underline">
        {list.title}
      </Link>
      {isOwner && list.visibility === 'private' && (
        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs">
          {t('privateBadge')}
        </span>
      )}
      {list.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{list.description}</p>
      )}
      <p className="text-sm text-muted-foreground">{t('cityCount', { count: list.entryCount })}</p>
    </li>
  );
}
